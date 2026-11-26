export function PlaybackIcon({ paused }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paused ? <path d="m8 5 11 7-11 7V5Z" /> : <><path d="M8 5v14M16 5v14" /></>}
  </svg>
}
