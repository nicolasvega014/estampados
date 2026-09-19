import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "models")
os.makedirs(OUT_DIR, exist_ok=True)

for item in list(bpy.data.objects):
    bpy.data.objects.remove(item, do_unlink=True)

def material(name, color, roughness=0.72):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

cloth = material("Cotton", (0.91, 0.91, 0.88), 0.88)
seam = material("Seams", (0.62, 0.62, 0.59), 0.68)

def extruded_outline(name, points, depth, mat, bevel=0.06):
    """Creates a beveled prism from an x/z silhouette, extruded along y."""
    verts = []
    for y in (-depth / 2, depth / 2):
        verts.extend([(x, y, z) for x, z in points])
    count = len(points)
    faces = [tuple(range(count)), tuple(range(count, count * 2))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, j + count, i + count))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bevel_mod = obj.modifiers.new("Soft fabric edges", "BEVEL")
    bevel_mod.width = bevel
    bevel_mod.segments = 3
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj

# A single continuous mesh keeps the torso and sleeves seamless in the web renderer.
torso = extruded_outline(
    "T-Shirt Body",
    [
        (-0.78, 3.28), (-1.16, 3.00), (-1.46, 3.02), (-2.13, 2.43),
        (-1.66, 1.83), (-1.03, 2.22), (-1.03, 0.08), (1.03, 0.08),
        (1.03, 2.22), (1.66, 1.83), (2.13, 2.43), (1.46, 3.02),
        (1.16, 3.00), (0.78, 3.28),
    ],
    0.38,
    cloth,
    0.08,
)
torso["print_area_front"] = {"center": [0, -0.215, 1.78], "size": [1.45, 1.85]}
torso["print_area_back"] = {"center": [0, 0.215, 1.78], "size": [1.45, 1.85]}

# A stretched torus forms a thick rib-knit collar.
bpy.ops.mesh.primitive_torus_add(major_radius=0.54, minor_radius=0.065, major_segments=48, minor_segments=10, location=(0, -0.205, 3.08), rotation=(math.pi / 2, 0, 0))
collar = bpy.context.object
collar.name = "Ribbed collar"
collar.scale = (1.40, 0.78, 1.0)
collar.data.materials.append(seam)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def stitch(name, start, end):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.012
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(1)
    spline.points[0].co = (*start, 1)
    spline.points[1].co = (*end, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(seam)
    return obj

# Fine front-facing seam accents.
stitch("Left shoulder seam", (-0.78, -0.212, 3.20), (-1.10, -0.212, 2.84))
stitch("Right shoulder seam", (0.78, -0.212, 3.20), (1.10, -0.212, 2.84))
stitch("Hem seam", (-0.96, -0.212, 0.18), (0.96, -0.212, 0.18))

# Presentation-only ground, camera and soft studio lights. Hidden from GLB export.
bpy.ops.mesh.primitive_plane_add(size=18, location=(0, 0.7, -0.12))
ground = bpy.context.object
ground.name = "Studio floor"
ground.data.materials.append(material("Floor", (0.075, 0.078, 0.07), 1.0))

bpy.ops.object.camera_add(location=(0, -10.4, 2.1), rotation=(math.radians(82), 0, 0))
camera = bpy.context.object
camera.name = "Preview camera"
camera.rotation_euler = (math.radians(90), 0, 0)
camera.data.lens = 54
bpy.context.scene.camera = camera

def point_light(location, energy, size):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (math.radians(90), 0, 0)
    return light

key = point_light((-3.6, -4.0, 5.0), 650, 4.0)
key.rotation_euler = (math.radians(62), 0, math.radians(-28))
fill = point_light((3.8, -2.5, 3.0), 350, 3.5)
fill.rotation_euler = (math.radians(74), 0, math.radians(35))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world.color = (0.035, 0.038, 0.032)
scene.render.filepath = os.path.join(OUT_DIR, "tinta-club-tshirt-preview.png")

# Render a visual check before export.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "tinta-club-tshirt.blend"))
bpy.ops.render.render(write_still=True)

# Do not ship camera, lights, floor, or preview-only materials in the web model.
for obj in [ground, camera, key, fill]:
    obj.select_set(False)
for obj in bpy.context.scene.objects:
    obj.select_set(obj.name not in {ground.name, camera.name, key.name, fill.name})
bpy.context.view_layer.objects.active = torso
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT_DIR, "tinta-club-tshirt.glb"),
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
    export_apply=True,
)
