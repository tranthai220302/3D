import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const H = (x, z) =>
  Math.sin(x * 0.012) * 12 + Math.cos(z * 0.01) * 10 + Math.sin((x + z) * 0.03) * 5 +
  Math.sin(x * 0.07) * Math.cos(z * 0.06) * 2
const GLSL_H = `
float hgt(vec2 p){
  return sin(p.x*0.012)*12.0 + cos(p.y*0.01)*10.0 + sin((p.x+p.y)*0.03)*5.0
       + sin(p.x*0.07)*cos(p.y*0.06)*2.0;
}`
const FOG = [1.0, 0.55, 0.3]
const NIGHT = [0.2, 0.12, 0.38]
const SUN = new THREE.Vector3(0.3, 0.07, 0.95).normalize()
const MOON = new THREE.Vector3(-0.5, 0.45, -0.74).normalize()

const skyV = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
const skyF = `
varying vec3 vP; uniform vec3 uSun; uniform float uAlt;
void main(){
  vec3 d = normalize(vP); float h = max(d.y, 0.0);
  vec3 c = mix(vec3(1.0,0.55,0.30), vec3(0.93,0.33,0.50), smoothstep(0.0,0.18,h));
  c = mix(c, vec3(0.40,0.22,0.58), smoothstep(0.15,0.5,h));
  c = mix(c, vec3(0.08,0.10,0.32), smoothstep(0.45,1.0,h));
  float s = max(dot(d,uSun),0.0);
  c += vec3(1.0,0.6,0.25)*pow(s,6.0)*0.6 + vec3(1.0,0.9,0.6)*pow(s,300.0)*3.0;
  vec3 night = mix(vec3(0.20,0.12,0.38), vec3(0.02,0.03,0.12), smoothstep(0.0,0.6,h));
  c = mix(c, night + vec3(1.0,0.5,0.25)*pow(s,6.0)*0.25, uAlt*0.85);
  gl_FragColor = vec4(c,1.0);
}`
const groundV = `${GLSL_H}
varying vec3 vW; varying vec3 vN; varying float vD;
void main(){
  vec4 w = modelMatrix*vec4(position,1.0);
  w.y = hgt(w.xz); vW = w.xyz;
  vN = normalize(vec3(hgt(w.xz-vec2(1,0))-hgt(w.xz+vec2(1,0)), 2.0, hgt(w.xz-vec2(0,1))-hgt(w.xz+vec2(0,1))));
  vD = length(cameraPosition - w.xyz);
  gl_Position = projectionMatrix*viewMatrix*w;
}`
const groundF = `
varying vec3 vW; varying vec3 vN; varying float vD; uniform vec3 uSun; uniform vec3 uFog;
void main(){
  float t = 0.5 + 0.5*sin(vW.x*0.015 + sin(vW.z*0.012)*2.0) * cos(vW.z*0.02 + sin(vW.x*0.01)*1.5);
  vec3 pal = 0.5 + 0.5*cos(6.2831*(t*1.2 + vec3(0.0,0.33,0.67)));
  vec3 col = pal*0.85 + 0.12;
  col *= 0.35 + 0.9*max(dot(normalize(vN), uSun), 0.0);
  col *= vec3(1.0,0.88,0.75);
  col = mix(col, uFog, smoothstep(50.0, 220.0, vD));
  gl_FragColor = vec4(col,1.0);
}`

const std = (c, e = 0.08, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: c, emissiveIntensity: e, side: THREE.DoubleSide, ...extra })
const put = (p, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o }

// ---------- Chim: thân thuôn, đầu trắng, mỏ quặp, cánh nhiều lông ----------
const featherGeo = (len, w) => {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.quadraticCurveTo(len * 0.55, w, len, 0.02); s.quadraticCurveTo(len * 0.5, -w * 0.55, 0, 0)
  return new THREE.ShapeGeometry(s, 4).rotateX(-Math.PI / 2)
}
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), 20).rotateX(Math.PI / 2)

function makeBird(body, wing, head, scale = 1, lite = false) {
  const g = new THREE.Group()
  const B = new THREE.Color(body), W = new THREE.Color(wing), Hd = new THREE.Color(head)
  const dark = W.clone().lerp(new THREE.Color(0x000000), 0.3)
  const prof = [[0, -1.1], [0.12, -0.9], [0.3, -0.5], [0.42, 0], [0.4, 0.4], [0.3, 0.75], [0.18, 1.0], [0, 1.1]]
  put(g, lathe(prof), std(B), 0, 0, 0).scale.set(1, 0.9, 1.2)
  put(g, lathe(prof), std(B.clone().lerp(new THREE.Color(0xffffff), 0.5)), 0, -0.13, 0.05).scale.set(0.8, 0.6, 1.1)
  put(g, new THREE.SphereGeometry(0.34, 16, 12), std(Hd), 0, 0.14, 0.78)
  put(g, new THREE.SphereGeometry(0.3, 16, 12), std(Hd), 0, 0.24, 1.02)
  put(g, new THREE.ConeGeometry(0.11, 0.44, 10), std(0xf2b01e, 0.2), 0, 0.16, 1.42).rotation.x = Math.PI / 2
  put(g, new THREE.ConeGeometry(0.05, 0.14, 8), std(0xd89a10, 0.2), 0, 0.07, 1.6).rotation.x = Math.PI * 0.75
  ;[-1, 1].forEach((s) => {
    put(g, new THREE.SphereGeometry(0.065, 10, 8), std(0xffd23a, 0.5), s * 0.21, 0.31, 1.14)
    put(g, new THREE.SphereGeometry(0.035, 8, 6), std(0x000000, 0), s * 0.255, 0.31, 1.16)
    if (!lite) put(g, new THREE.CylinderGeometry(0.04, 0.03, 0.45, 6), std(0xf2b01e, 0.2), s * 0.16, -0.5, 0.1).rotation.x = 0.9
  })
  const nt = lite ? 5 : 7
  for (let i = 0; i < nt; i++) {
    const f = put(g, featherGeo(1.15, 0.2), std(W.clone().lerp(Hd, 0.5)), 0, 0.02, -0.9)
    f.rotation.y = Math.PI / 2 + (i - (nt - 1) / 2) * 0.11
    f.rotation.x = 0.04
  }
  const mkWing = (s) => {
    const p = new THREE.Group(); p.position.set(s * 0.28, 0.14, 0.25)
    if (s < 0) p.scale.x = -1
    g.add(p)
    const ni = lite ? 3 : 5
    for (let i = 0; i < ni; i++) put(p, featherGeo(1.05 - i * 0.07, 0.24), std(W.clone().lerp(B, i * 0.05))).rotation.y = 0.08 + i * 0.15
    put(p, featherGeo(1.0, 0.5), std(B, 0.06), 0, 0.012, 0.05)
    const q = new THREE.Group(); q.position.set(1.02, 0, -0.06); p.add(q)
    const no = lite ? 4 : 7
    for (let i = 0; i < no; i++) put(q, featherGeo(1.35 - i * 0.08, 0.22), std(dark.clone().lerp(W, i * 0.06))).rotation.y = -0.16 + i * 0.13
    return { p, q }
  }
  g.userData = { L: mkWing(1), R: mkWing(-1) }
  g.scale.setScalar(scale)
  return g
}
const flap = (g, a) => {
  const { L, R } = g.userData
  L.p.rotation.z = a; L.q.rotation.z = a * 0.75
  R.p.rotation.z = -a; R.q.rotation.z = -a * 0.75
}

// ---------- Tiên nữ ----------
function makeFairy(dressHex) {
  const g = new THREE.Group()
  const skin = std(0xf6d5b8, 0.15), hair = std(0x1a1216, 0.05), dress = std(dressHex, 0.3)
  put(g, new THREE.SphereGeometry(0.22, 14, 12), skin, 0, 1.95, 0)
  put(g, new THREE.SphereGeometry(0.24, 14, 12), hair, 0, 2.0, -0.05)
  put(g, new THREE.ConeGeometry(0.22, 1.1, 10), hair, 0, 1.45, -0.18).rotation.x = -0.25
  put(g, new THREE.CylinderGeometry(0.18, 0.2, 0.55, 10), dress, 0, 1.5, 0)
  put(g, new THREE.ConeGeometry(0.6, 1.5, 18, 1, true), dress, 0, 0.8, 0)
  ;[-1, 1].forEach((s) => put(g, new THREE.CylinderGeometry(0.05, 0.04, 0.8, 6), skin, s * 0.38, 1.5, 0.15).rotation.set(0.5, 0, s * 1.1))
  const rib = []
  let parent = g, pz = -0.15
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Group(); p.position.set(0, i ? 0 : 1.55, pz); parent.add(p)
    put(p, new THREE.PlaneGeometry(0.5, 0.45).rotateY(Math.PI / 2), std(i % 2 ? 0xffffff : dressHex, 0.35, { transparent: true, opacity: 0.8 }), 0, 0, -0.25)
    rib.push(p); parent = p; pz = -0.5
  }
  const wings = [-1, 1].map((s) => put(g, new THREE.CircleGeometry(0.7, 14), std(0xffe6f5, 0.6, { transparent: true, opacity: 0.5 }), s * 0.5, 1.65, -0.2))
  wings.forEach((w) => w.scale.set(0.8, 1.3, 1))
  g.userData = { rib, wings }
  g.scale.setScalar(2.2)
  return g
}

// ---------- Cung điện trên mây ----------
function makePalace() {
  const g = new THREE.Group()
  const M = (c, e = 0.3) => std(c, e, { fog: false })
  put(g, new THREE.ConeGeometry(34, 30, 9), M(0x6b5a82, 0.12), 0, -15, 0).rotation.x = Math.PI
  put(g, new THREE.CylinderGeometry(36, 34, 3, 24), M(0x7ed6a5, 0.25), 0, 1.5, 0)
  put(g, new THREE.CylinderGeometry(24, 26, 3, 8), M(0xf5efe6, 0.4), 0, 4.5, 0)
  for (let i = 0; i < 3; i++) put(g, new THREE.BoxGeometry(10 - i * 1.5, 1, 6 - i), M(0xf5efe6, 0.4), 0, 6.5 + i, 11 - i * 0.6)
  put(g, new THREE.BoxGeometry(22, 12, 15), M(0xc0392b, 0.35), 0, 12, 0)
  for (let i = -3; i <= 3; i++) put(g, new THREE.CylinderGeometry(0.7, 0.7, 12, 10), M(0xf1c40f, 0.5), i * 3.4, 12, 7.8)
  const roof = (r, h, y, c) => { const o = put(g, new THREE.ConeGeometry(r, h, 4), M(c, 0.5), 0, y, 0); o.rotation.y = Math.PI / 4; return o }
  roof(19, 7, 21.5, 0xf1c40f); roof(14, 6.5, 27.5, 0xf39c12); roof(9, 6, 33, 0xf1c40f)
  put(g, new THREE.SphereGeometry(1.6, 12, 10), M(0xffe27a, 1), 0, 38, 0)
  put(g, new THREE.CylinderGeometry(0.2, 0.2, 7, 6), M(0xf1c40f, 0.6), 0, 36, 0)
  ;[[-17, -13], [17, -13], [-17, 13], [17, 13]].forEach(([x, z]) => {
    put(g, new THREE.BoxGeometry(5, 8, 5), M(0xc0392b, 0.35), x, 10, z)
    const r = put(g, new THREE.ConeGeometry(4.6, 4, 4), M(0xf1c40f, 0.5), x, 16, z); r.rotation.y = Math.PI / 4
    put(g, new THREE.SphereGeometry(0.9, 8, 8), M(0xffa94d, 1.2), x, 7, z + Math.sign(z) * 3)
  })
  g.add(new THREE.PointLight(0xffd27a, 3000, 170, 2).translateY(20))
  return g
}

const moonTex = () => {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d'); x.fillStyle = '#f1ead8'; x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 45; i++) {
    x.fillStyle = `rgba(150,140,125,${0.15 + Math.random() * 0.25})`
    x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 20, 0, 6.283); x.fill()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
const haloTex = () => {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 8, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,240,200,0.85)'); g.addColorStop(1, 'rgba(255,240,200,0)')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
const blob = (r, x, y, z, seed) => {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    v.multiplyScalar(1 + 0.18 * Math.sin(v.x * 3.1 + seed) * Math.cos(v.z * 2.7 + seed * 1.3) + 0.1 * Math.sin(v.y * 4 + seed))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.translate(x, y, z); g.computeVertexNormals(); return g
}
const wrap = (v, c, S) => v - S * Math.round((v - c) / S)
const fogColor = (a, out) => new THREE.Color().setRGB(
  FOG[0] + (NIGHT[0] - FOG[0]) * a, FOG[1] + (NIGHT[1] - FOG[1]) * a, FOG[2] + (NIGHT[2] - FOG[2]) * a, THREE.SRGBColorSpace).toArray(out || [])

export default function Scene() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(new THREE.Color().setRGB(...FOG, THREE.SRGBColorSpace), 50, 220)
    const camera = new THREE.PerspectiveCamera(65, el.clientWidth / el.clientHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)

    // Bầu trời + mặt trăng + sao (đi theo camera)
    const skyG = new THREE.Group(); scene.add(skyG)
    const skyMat = new THREE.ShaderMaterial({ vertexShader: skyV, fragmentShader: skyF, uniforms: { uSun: { value: SUN }, uAlt: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false })
    skyG.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat))
    const moon = put(skyG, new THREE.SphereGeometry(36, 32, 24), new THREE.MeshBasicMaterial({ map: moonTex(), fog: false }))
    moon.position.copy(MOON).multiplyScalar(420)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }))
    halo.scale.setScalar(260); halo.position.copy(moon.position); skyG.add(halo)
    const sp = new Float32Array(1600 * 3)
    for (let i = 0; i < 1600; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(470)
      sp.set([v.x, v.y, v.z], i * 3)
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.2, fog: false, depthWrite: false }))
    skyG.add(stars)

    scene.add(new THREE.HemisphereLight(0xff9ec0, 0x4a2c6e, 1.0))
    const sunLight = new THREE.DirectionalLight(0xffa860, 2.2)
    sunLight.position.copy(SUN).multiplyScalar(100)
    scene.add(sunLight)

    // Mặt đất vô tận
    const groundMat = new THREE.ShaderMaterial({ vertexShader: groundV, fragmentShader: groundF, uniforms: { uSun: { value: SUN }, uFog: { value: new THREE.Vector3(...FOG) } } })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 480, 120, 120).rotateX(-Math.PI / 2), groundMat)
    ground.frustumCulled = false; scene.add(ground)

    // Cây: thân + tán lá tròn (nhiều màu) hoặc cây thông nhiều tầng
    const TS = 440, TN = 700
    const crownB = mergeGeometries([blob(2.6, 0, 6.5, 0, 1), blob(2.0, 1.6, 5.4, 0.6, 2), blob(2.1, -1.5, 5.6, -0.5, 3), blob(1.7, 0.2, 8.2, 0.4, 4)])
    const crownP = mergeGeometries([[2.6, 3.2, 3.6], [2.1, 3, 5.4], [1.5, 2.8, 7.2], [0.9, 2.2, 8.8]].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 8).translate(0, y, 0)))
    const mk = (geo, n, c) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(c ? { color: c } : {}), n); m.frustumCulled = false; scene.add(m); return m }
    const trunks = mk(new THREE.CylinderGeometry(0.28, 0.45, 4.5, 6).translate(0, 2.25, 0), TN, 0x5a3d28)
    const cB = mk(crownB, TN / 2), cP = mk(crownP, TN / 2)
    const leaf = [0x2e7d32, 0x558b2f, 0xe65100, 0xc62828, 0xf48fb1, 0xffb300, 0x7b1fa2]
    const tr = Array.from({ length: TN }, (_, i) => ({ x: Math.random() * TS, z: Math.random() * TS, s: 0.8 + Math.random() * 0.9, pine: i % 2, k: i >> 1 }))
    tr.forEach((t) => {
      const c = new THREE.Color(t.pine ? [0x1b5e20, 0x2e7d32, 0x00695c][t.k % 3] : leaf[Math.floor(Math.random() * leaf.length)])
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1); (t.pine ? cP : cB).setColorAt(t.k, c)
    })

    // Mây: cụm nhiều cục xốp, có tầng "biển mây" trên cao
    const CS = 600, CN = 52
    const cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshLambertMaterial({ emissive: 0x6a3a50 }), CN * 8)
    cloudMesh.frustumCulled = false; scene.add(cloudMesh)
    const cl = Array.from({ length: CN }, (_, i) => {
      const sea = i >= 28, sz = sea ? 1.8 : 1
      const col = new THREE.Color().setHSL(0.93 + Math.random() * 0.12, 0.7, 0.8)
      const puffs = Array.from({ length: 8 }, (_, j) => {
        cloudMesh.setColorAt(i * 8 + j, col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1))
        return { dx: (Math.random() - 0.5) * 38 * sz, dy: Math.random() * 5, dz: (Math.random() - 0.5) * 20 * sz, r: (7 + Math.random() * 9) * sz }
      })
      return { x: Math.random() * CS, z: Math.random() * CS, y: sea ? 190 + Math.random() * 25 : 70 + Math.random() * 50, puffs }
    })

    // Thú trên mặt đất
    const AN = 36
    const bodies = mk(new THREE.BoxGeometry(0.7, 0.8, 1.4), AN), heads = mk(new THREE.SphereGeometry(0.35, 8, 8), AN)
    const an = Array.from({ length: AN }, (_, i) => {
      const c = new THREE.Color().setHSL(Math.random(), 0.65, 0.6); bodies.setColorAt(i, c); heads.setColorAt(i, c)
      return { x: (Math.random() - 0.5) * TS, z: (Math.random() - 0.5) * TS, yaw: Math.random() * 6.28, s: 1 + Math.random() * 1.8, sp: 1 + Math.random() * 2 }
    })

    // Đàn chim khác
    const SPECIES = [[0xf5f5f5, 0x8d99a6, 0xf5f5f5], [0x2b4a7a, 0x1d2f4d, 0xd9824b], [0x7a3b2e, 0x5c2d22, 0xe8d0b0], [0x3f8f6b, 0x2a6b4f, 0xffd54f]]
    const flock = Array.from({ length: 14 }, (_, i) => {
      const g = makeBird(...SPECIES[i % 4], 1.2, true); scene.add(g)
      return { g, x: (Math.random() - 0.5) * TS, z: (Math.random() - 0.5) * TS, y: 40 + Math.random() * 50, yaw: Math.random() * 6.28, sp: 10 + Math.random() * 6, ph: Math.random() * 9 }
    })

    // Hai cung điện trên trời + tiên nữ bay quanh
    const PS = 1100
    const pal = [{ x: 120, z: 420, y: 230 }, { x: -380, z: -300, y: 300 }].map((p) => { p.g = makePalace(); scene.add(p.g); return p })
    const dresses = [0xff8fb8, 0x7fe0ff, 0xc9a7ff, 0xffe27a, 0xffffff]
    const fairies = Array.from({ length: 10 }, (_, i) => {
      const g = makeFairy(dresses[i % 5]); scene.add(g)
      return { g, pi: i % 2, a: Math.random() * 6.28, R: 30 + Math.random() * 20, hy: 12 + Math.random() * 18, w: 0.3 + Math.random() * 0.2 }
    })

    // Con chim của bạn: đại bàng đầu trắng
    const bird = makeBird(0x6b4a2f, 0x4a3222, 0xf4efe6, 1.5)
    scene.add(bird)
    const P = { x: 0, y: H(0, 0) + 35, z: 0, yaw: Math.atan2(SUN.x, SUN.z), speed: 16, vy: 0, bank: 0 }
    let wph = 0

    const keys = {}
    const down = (e) => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault() }
    const up = (e) => { keys[e.code] = false }
    addEventListener('keydown', down); addEventListener('keyup', up)

    const o = new THREE.Object3D(), clock = new THREE.Clock()
    const camGoal = new THREE.Vector3(), look = new THREE.Vector3(), fc = []
    let t = 0, id

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      t += dt
      const k = (c) => !!keys[c]
      const turn = (k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0)
      const wantSpeed = k('KeyW') || k('ArrowUp') ? 32 : k('KeyS') || k('ArrowDown') ? 8 : 16
      const wantVy = (k('Space') ? 12 : 0) - (k('ShiftLeft') || k('ShiftRight') ? 12 : 0)
      P.yaw += turn * 1.4 * dt
      P.speed += (wantSpeed - P.speed) * Math.min(1, 2 * dt)
      P.vy += (wantVy - P.vy) * Math.min(1, 3 * dt)
      P.bank += (-turn * 0.7 - P.bank) * Math.min(1, 4 * dt)
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw)
      P.x += fx * P.speed * dt; P.z += fz * P.speed * dt
      P.y = Math.min(340, Math.max(H(P.x, P.z) + 3, P.y + P.vy * dt))

      wph += dt * (5 + P.speed * 0.2)
      flap(bird, wantVy < 0 ? 0.1 : Math.sin(wph) * 0.55 + 0.05)
      bird.position.set(P.x, P.y, P.z)
      bird.rotation.set(-Math.atan2(P.vy, P.speed), P.yaw, P.bank, 'YXZ')

      camGoal.set(P.x - fx * 13, P.y + 4.5, P.z - fz * 13)
      camGoal.y = Math.max(camGoal.y, H(camGoal.x, camGoal.z) + 2)
      camera.position.lerp(camGoal, 1 - Math.exp(-5 * dt))
      look.set(P.x + fx * 8, P.y + 1, P.z + fz * 8)
      camera.lookAt(look)
      camera.fov = 65 + (P.speed - 16) * 0.4
      camera.updateProjectionMatrix()

      // Càng bay cao, trời càng tối dần, hiện sao
      const a = Math.min(1, Math.max(0, (P.y - 90) / 200))
      skyMat.uniforms.uAlt.value = a
      stars.material.opacity = 0.2 + 0.8 * a
      fogColor(a, fc); scene.fog.color.setRGB(fc[0], fc[1], fc[2])
      groundMat.uniforms.uFog.value.set(FOG[0] + (NIGHT[0] - FOG[0]) * a, FOG[1] + (NIGHT[1] - FOG[1]) * a, FOG[2] + (NIGHT[2] - FOG[2]) * a)

      skyG.position.copy(camera.position)
      ground.position.set(Math.round(P.x / 4) * 4, 0, Math.round(P.z / 4) * 4)

      let ib = 0, ip = 0
      tr.forEach((s, i) => {
        const x = wrap(s.x, P.x, TS), z = wrap(s.z, P.z, TS)
        o.position.set(x, H(x, z), z); o.rotation.set(0, i, 0); o.scale.setScalar(s.s); o.updateMatrix()
        trunks.setMatrixAt(i, o.matrix); (s.pine ? cP : cB).setMatrixAt(s.k, o.matrix)
      })
      trunks.instanceMatrix.needsUpdate = cB.instanceMatrix.needsUpdate = cP.instanceMatrix.needsUpdate = true

      cl.forEach((c, i) => {
        c.x += 1.5 * dt
        const cx = wrap(c.x, P.x, CS), cz = wrap(c.z, P.z, CS)
        c.puffs.forEach((p, j) => {
          o.position.set(cx + p.dx, c.y + p.dy, cz + p.dz); o.rotation.set(0, 0, 0); o.scale.set(p.r, p.r * 0.6, p.r * 0.85); o.updateMatrix()
          cloudMesh.setMatrixAt(i * 8 + j, o.matrix)
        })
      })
      cloudMesh.instanceMatrix.needsUpdate = true

      an.forEach((q, i) => {
        q.yaw += Math.sin(t * 0.4 + i) * 0.5 * dt
        q.x += Math.sin(q.yaw) * q.sp * dt; q.z += Math.cos(q.yaw) * q.sp * dt
        const x = wrap(q.x, P.x, TS), z = wrap(q.z, P.z, TS), y = H(x, z)
        o.position.set(x, y + 0.7 * q.s, z); o.rotation.set(0, q.yaw, 0); o.scale.setScalar(q.s); o.updateMatrix(); bodies.setMatrixAt(i, o.matrix)
        o.position.set(x + Math.sin(q.yaw) * 0.95 * q.s, y + 1.2 * q.s, z + Math.cos(q.yaw) * 0.95 * q.s); o.updateMatrix(); heads.setMatrixAt(i, o.matrix)
      })
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true

      flock.forEach((b) => {
        b.yaw += Math.sin(t * 0.3 + b.ph) * 0.4 * dt
        b.x += Math.sin(b.yaw) * b.sp * dt; b.z += Math.cos(b.yaw) * b.sp * dt
        b.g.position.set(wrap(b.x, P.x, TS), b.y + Math.sin(t + b.ph) * 2, wrap(b.z, P.z, TS))
        b.g.rotation.set(0, b.yaw, Math.sin(t * 0.3 + b.ph) * 0.3, 'YXZ')
        flap(b.g, Math.sin(t * 7 + b.ph) * 0.5)
      })

      pal.forEach((p) => { p.g.position.set(wrap(p.x, P.x, PS), p.y + Math.sin(t * 0.3) * 2, wrap(p.z, P.z, PS)); p.g.rotation.y = t * 0.03 })
      fairies.forEach((f) => {
        f.a += f.w * dt
        const c = pal[f.pi].g.position
        f.g.position.set(c.x + Math.cos(f.a) * f.R, c.y + f.hy + Math.sin(t + f.a * 3) * 3, c.z + Math.sin(f.a) * f.R)
        f.g.rotation.set(0.35, Math.atan2(-Math.sin(f.a), Math.cos(f.a)), 0, 'YXZ')
        f.g.userData.rib.forEach((r, i) => { r.rotation.y = Math.sin(t * 3 - i * 0.7) * 0.5 })
        f.g.userData.wings.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (0.6 + Math.sin(t * 9 + f.a) * 0.4) })
      })

      renderer.render(scene, camera)
      id = requestAnimationFrame(loop)
    }
    loop()

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(id)
      removeEventListener('resize', onResize)
      removeEventListener('keydown', down); removeEventListener('keyup', up)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={ref} style={{ position: 'fixed', inset: 0 }} />
}