import { randomUUID } from 'node:crypto'
import { getAdminFirestore, FieldValue } from '../server/firebase-admin.js'
import {
  CheckoutError,
  checkoutErrorPayload,
  couponCustomerKey,
  isFinalMercadoPagoOrder,
  isPaidMercadoPagoOrder,
  quoteCheckout,
  reserveCouponUse,
  safeCustomer,
  safeOrderItems,
  settleCouponUse,
  shouldRedeemCouponUse,
} from '../server/checkout.js'

function send(res, status, body) {
  res.status(status).json(body)
}

function readPaymentStatus(order) {
  const transaction = order?.transactions?.payments?.[0] || {}
  return {
    status: String(order?.status || transaction.status || '').toLowerCase(),
    statusDetail: String(order?.status_detail || transaction.status_detail || '').toLowerCase(),
  }
}

function couponSnapshot(coupon) {
  if (!coupon) return null
  return {
    code: coupon.code,
    title: coupon.title,
    type: coupon.discountType,
    value: coupon.discountValue,
    discountAmount: coupon.discountAmount,
    eligibleSubtotal: coupon.eligibleSubtotal,
  }
}

function hasDefinitiveMercadoPagoFailure(status) {
  // Mercado Pago validation/decline responses did not create a payable order.
  // Retriable or infrastructure responses stay locked until a signed webhook
  // tells us the real outcome.
  return [400, 401, 402, 403, 404, 422].includes(status)
}

function mercadoPagoFailureMessage(order, fallback) {
  const cause = Array.isArray(order?.cause)
    ? order.cause.map((item) => item?.description || item?.code).find(Boolean)
    : ''
  const message = String(order?.message || order?.error || cause || '').trim()
  // Keep the response useful without serializing the full provider payload or
  // any card-related fields.
  return message && message.length <= 220 ? message : fallback
}

function checkoutAttemptId(value) {
  const id = String(value || '').trim()
  // Older browser tabs do not send this field. Give them an isolated attempt
  // instead of breaking a real checkout during a deployment.
  return /^[A-Za-z0-9_-]{20,128}$/.test(id) ? id : `checkout-${randomUUID()}`
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

async function saveOrder(db, reference, data) {
  if (!db) return
  await db.collection('orders').doc(reference).set({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

async function saveCheckoutAttempt(db, attemptId, data) {
  await db.collection('checkoutAttempts').doc(attemptId).set({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

async function findCheckoutAttempt(db, attemptId) {
  const snapshot = await db.collection('checkoutAttempts').doc(attemptId).get()
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null
}

async function beginCheckoutAttempt(db, attemptId, quote) {
  const attemptRef = db.collection('checkoutAttempts').doc(attemptId)
  let result = null

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(attemptRef)
    if (existing.exists) {
      result = { created: false, attempt: { id: existing.id, ...existing.data() } }
      return
    }

    const reference = `fenixis-${Date.now()}-${randomUUID().slice(0, 8)}`
    const attempt = {
      id: attemptId,
      reference,
      mercadoPagoIdempotencyKey: randomUUID(),
      state: 'created',
      subtotal: quote.totals.subtotal,
      discount: quote.totals.discount,
      total: quote.totals.total,
      couponCode: quote.coupon?.code || '',
    }
    transaction.create(attemptRef, {
      ...attempt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    result = { created: true, attempt }
  })

  return result
}

function sendExistingAttempt(res, attempt) {
  const state = String(attempt?.state || '')
  if (state === 'completed' || state === 'pending') {
    return send(res, 200, {
      id: attempt.mercadoPagoOrderId || '',
      reference: attempt.reference || '',
      status: attempt.status || (state === 'completed' ? 'approved' : 'pending'),
      statusDetail: attempt.statusDetail || '',
    })
  }

  if (state === 'failed') {
    return send(res, 409, {
      code: 'CHECKOUT_CAN_RETRY',
      retryable: true,
      message: 'El intento anterior no pudo completarse. Revisá los datos de pago e intentá nuevamente.',
    })
  }

  return send(res, 409, {
    code: 'CHECKOUT_IN_PROGRESS',
    retryable: false,
    message: 'Estamos confirmando un intento de pago anterior. Esperá unos minutos antes de volver a intentarlo.',
  })
}

function checkoutConfigurationError() {
  return new CheckoutError('El checkout seguro se está terminando de configurar. Probá nuevamente en unos minutos.', 'CHECKOUT_NOT_CONFIGURED', 503)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { message: 'Método no permitido.' })

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) return send(res, 503, { message: 'El checkout no está configurado todavía.' })

  let db = null
  let externalReference = ''
  let attemptId = ''
  let attemptCreated = false
  let reservationCreated = false
  let paymentRequestStarted = false

  try {
    const { cart, customer, couponCode, payment } = req.body || {}
    const payerEmail = String(payment?.payer?.email || '').trim().toLowerCase()
    const paymentMethodId = String(payment?.paymentMethodId || '').trim()
    const paymentType = String(payment?.paymentType || '').trim()
    const token = String(payment?.token || '').trim()
    const installments = Number(payment?.installments)

    if (!payerEmail || !paymentMethodId || !paymentType || !token || !Number.isInteger(installments) || installments < 1) {
      return send(res, 400, { message: 'Faltan datos necesarios para procesar el pago.' })
    }

    try {
      db = getAdminFirestore()
    } catch {
      throw checkoutConfigurationError()
    }

    attemptId = checkoutAttemptId(req.body?.checkoutAttemptId)
    if (db) {
      const previousAttempt = await findCheckoutAttempt(db, attemptId)
      if (previousAttempt) return sendExistingAttempt(res, previousAttempt)
    }

    const quote = await quoteCheckout({ db, cart, couponCode, reconcileReservations: true })
    if (quote.coupon && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      throw new CheckoutError('Los códigos promocionales todavía no están configurados para confirmar pagos pendientes.', 'COUPON_WEBHOOK_NOT_CONFIGURED', 503)
    }
    const safeBuyer = safeCustomer(customer, payerEmail)
    const attemptResult = db
      ? await beginCheckoutAttempt(db, attemptId, quote)
      : {
          created: true,
          attempt: {
            reference: `fenixis-${attemptId}`,
            mercadoPagoIdempotencyKey: isUuid(attemptId) ? attemptId : randomUUID(),
          },
        }
    if (!attemptResult.created) return sendExistingAttempt(res, attemptResult.attempt)

    attemptCreated = Boolean(db)
    externalReference = attemptResult.attempt.reference

    if (quote.coupon) {
      await reserveCouponUse({
        db,
        quote,
        externalReference,
        customerKey: couponCustomerKey(payerEmail),
      })
      reservationCreated = true
    }

    // This order summary deliberately excludes the card token and card data.
    await saveOrder(db, externalReference, {
      reference: externalReference,
      checkoutAttemptId: attemptId,
      customer: safeBuyer,
      customerName: safeBuyer.name,
      delivery: safeBuyer.delivery,
      status: 'processing',
      statusDetail: 'waiting_for_mercado_pago',
      items: safeOrderItems(quote.items),
      subtotal: quote.totals.subtotal,
      discount: quote.totals.discount,
      total: quote.totals.total,
      coupon: couponSnapshot(quote.coupon),
      createdAt: FieldValue.serverTimestamp(),
    })

    if (db) await saveCheckoutAttempt(db, attemptId, { state: 'submitting' })

    const payer = { email: payerEmail }
    if (payment?.payer?.identification?.type && payment?.payer?.identification?.number) {
      payer.identification = {
        type: String(payment.payer.identification.type),
        number: String(payment.payer.identification.number),
      }
    }

    paymentRequestStarted = true
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': attemptResult.attempt.mercadoPagoIdempotencyKey,
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'automatic',
        total_amount: quote.totals.total.toFixed(2),
        external_reference: externalReference,
        payer,
        transactions: {
          payments: [{
            amount: quote.totals.total.toFixed(2),
            payment_method: {
              id: paymentMethodId,
              type: paymentType,
              token,
              installments,
            },
          }],
        },
      }),
    })

    const order = await response.json().catch(() => ({}))
    const paymentState = readPaymentStatus(order)
    const paid = isPaidMercadoPagoOrder(order)
    const couponRedeemed = shouldRedeemCouponUse(order)
    const final = isFinalMercadoPagoOrder(order)

    if (!response.ok) {
      const settleNow = final || hasDefinitiveMercadoPagoFailure(response.status)
      let couponSettlement = quote.coupon
        ? settleNow ? (couponRedeemed ? 'redeemed' : 'released') : 'reserved'
        : 'not_applicable'
      if (reservationCreated && settleNow) {
        try {
          await settleCouponUse({ db, externalReference, paid: couponRedeemed })
        } catch {
          couponSettlement = 'pending_settlement'
        }
      }

      const message = settleNow
        ? mercadoPagoFailureMessage(order, 'Mercado Pago no pudo procesar el pago.')
        : 'Mercado Pago está confirmando el resultado. Esperá unos minutos antes de volver a intentar.'
      const attemptState = settleNow ? (couponRedeemed ? 'completed' : 'failed') : 'pending'
      if (db) {
        await Promise.all([
          saveOrder(db, externalReference, {
            status: paymentState.status || (settleNow ? 'failed' : 'processing'),
            statusDetail: String(paymentState.statusDetail || mercadoPagoFailureMessage(order, settleNow ? 'mercado_pago_error' : 'mercado_pago_pending_confirmation')).slice(0, 240),
            couponSettlement,
          }).catch(() => {}),
          saveCheckoutAttempt(db, attemptId, {
            state: attemptState,
            mercadoPagoOrderId: String(order?.id || ''),
            status: paymentState.status || (settleNow ? 'failed' : 'pending'),
            statusDetail: String(paymentState.statusDetail || '').slice(0, 240),
            ...(settleNow ? { completedAt: FieldValue.serverTimestamp() } : {}),
          }).catch(() => {}),
        ])
      }
      return send(res, response.status, { message, retryable: settleNow && !couponRedeemed })
    }

    const couponSettlement = quote.coupon ? (final ? (couponRedeemed ? 'redeemed' : 'released') : 'reserved') : 'not_applicable'
    let savedSettlement = couponSettlement
    if (reservationCreated && final) {
      try {
        await settleCouponUse({ db, externalReference, paid: couponRedeemed })
      } catch {
        // A configured webhook retries this idempotently. Never turn an
        // already-approved payment into an error for the customer.
        savedSettlement = 'pending_settlement'
      }
    }

    const attemptState = paid || couponRedeemed ? 'completed' : final ? 'failed' : 'pending'
    if (db) {
      await Promise.all([
        saveOrder(db, externalReference, {
          mercadoPagoOrderId: String(order?.id || ''),
          status: paymentState.status || (paid ? 'approved' : 'pending'),
          statusDetail: paymentState.statusDetail || '',
          couponSettlement: savedSettlement,
          ...(paid ? { paidAt: FieldValue.serverTimestamp() } : {}),
        }).catch(() => {}),
        saveCheckoutAttempt(db, attemptId, {
          state: attemptState,
          mercadoPagoOrderId: String(order?.id || ''),
          status: paymentState.status || (paid ? 'approved' : 'pending'),
          statusDetail: paymentState.statusDetail || '',
          ...(final ? { completedAt: FieldValue.serverTimestamp() } : {}),
        }).catch(() => {}),
      ])
    }

    if (final && !paid && !couponRedeemed) {
      return send(res, 402, {
        code: 'PAYMENT_REJECTED',
        retryable: true,
        message: 'Mercado Pago no pudo procesar el pago. Revisá los datos de la tarjeta e intentá nuevamente.',
      })
    }

    return send(res, 200, {
      id: order.id,
      reference: externalReference,
      status: order.status || paymentState.status,
      statusDetail: order.status_detail || paymentState.statusDetail,
    })
  } catch (error) {
    // If the request never reached Mercado Pago, release the temporary use.
    // Once it was sent, the signed webhook owns the final settlement.
    if (reservationCreated && !paymentRequestStarted && db && externalReference) {
      await settleCouponUse({ db, externalReference, paid: false }).catch(() => {})
    }
    if (attemptCreated && db && attemptId) {
      await saveCheckoutAttempt(db, attemptId, {
        state: paymentRequestStarted ? 'pending' : 'failed',
        errorCode: error instanceof CheckoutError ? error.code : 'CHECKOUT_UNCONFIRMED',
        ...(paymentRequestStarted ? {} : { completedAt: FieldValue.serverTimestamp() }),
      }).catch(() => {})
    }

    if (paymentRequestStarted) {
      return send(res, 409, {
        code: 'CHECKOUT_IN_PROGRESS',
        retryable: false,
        message: 'Mercado Pago está confirmando el resultado. Esperá unos minutos antes de volver a intentarlo.',
      })
    }

    const status = error instanceof CheckoutError ? error.status : 500
    const payload = error instanceof CheckoutError
      ? checkoutErrorPayload(error)
      : { message: 'No pudimos procesar la compra. Probá nuevamente en unos minutos.' }
    return send(res, status, payload)
  }
}
