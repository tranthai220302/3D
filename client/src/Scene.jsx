import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const height = (x, z) =>
  Math.sin(x * 0.07) * 1.4 + Math.cos(z * 0.05) * 1.1 + Math.sin((x + z) * 0.13) * 0.5

const grassVert = `
  uniform float uTime;
  varying float vH;
  void main() {
    vH = uv.y;
    vec3 p = position;
    p.x *= 1.0 - uv.y * 0.85;
    vec4 w = instanceMatrix * vec4(p, 1.0);
    float sway = sin(uTime * 1.6 + w.x * 0.35 + w.z * 0.3) * 0.28 * uv.y * uv.y;
    w.x += sway;
    w.z += sway * 0.5;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * w;
  }
`
const grassFrag = `
  varying float vH;
  void main() {
    vec3 base = vec3(0.07, 0.28, 0.08);
    vec3 tip = vec3(0.72, 0.84, 0.28);
    gl_FragColor = vec4(mix(base, tip, vH), 1.0);
  }
`

// Người đơn giản: thân, đầu, 2 tay, 2 chân (xoay quanh khớp để đi bộ). Mặt hướng +z
function makePerson() {
  const g = new THREE.Group()
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c })
  const shirt = mat(0xe8523a), pants = mat(0x2b3a67), skin = mat(0xf1c7a0), hairM = mat(0x2a1d14)

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirt)
  torso.position.y = 1.35
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), skin)
  head.position.y = 2.1
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.295, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairM)
  hair.position.y = 2.12
  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8)
  const eyeMat = mat(0x111111)
  ;[-0.1, 0.1].forEach((x) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat)
    e.position.set(x, 2.13, 0.26)
    g.add(e)
  })

  const limb = (m, w, h, x, y) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, 0)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m)
    mesh.position.y = -h / 2
    pivot.add(mesh)
    return pivot
  }
  const legL = limb(pants, 0.28, 0.9, -0.18, 0.9)
  const legR = limb(pants, 0.28, 0.9, 0.18, 0.9)
  const armL = limb(shirt, 0.22, 0.8, -0.47, 1.75)
  const armR = limb(shirt, 0.22, 0.8, 0.47, 1.75)
  g.add(torso, head, hair, legL, legR, armL, armR)
  return { g, legL, legR, armL, armR }
}

export default function Scene() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x9fd3ff)
    scene.fog = new THREE.Fog(0x9fd3ff, 40, 110)

    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.domElement.style.touchAction = 'none'
    el.appendChild(renderer.domElement)

    // Mặt đất
    const groundGeo = new THREE.PlaneGeometry(240, 240, 120, 120)
    groundGeo.rotateX(-Math.PI / 2)
    const gp = groundGeo.attributes.position
    for (let i = 0; i < gp.count; i++) gp.setY(i, height(gp.getX(i), gp.getZ(i)))
    groundGeo.computeVertexNormals()
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x2f7a2f, roughness: 1 }))
    scene.add(ground)

    // Cỏ
    const COUNT = 16000
    const bladeGeo = new THREE.PlaneGeometry(0.14, 1, 1, 4)
    bladeGeo.translate(0, 0.5, 0)
    const grassMat = new THREE.ShaderMaterial({
      vertexShader: grassVert,
      fragmentShader: grassFrag,
      uniforms: { uTime: { value: 0 } },
      side: THREE.DoubleSide,
    })
    const grass = new THREE.InstancedMesh(bladeGeo, grassMat, COUNT)
    grass.frustumCulled = false
    const d = new THREE.Object3D()
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 90
      const z = (Math.random() - 0.5) * 90
      d.position.set(x, height(x, z), z)
      d.rotation.y = Math.random() * Math.PI
      d.scale.set(1, 0.7 + Math.random() * 1.1, 1)
      d.updateMatrix()
      grass.setMatrixAt(i, d.matrix)
    }
    scene.add(grass)

    // Ánh sáng, mặt trời, mây
    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a6b2a, 0.9))
    const sunLight = new THREE.DirectionalLight(0xfff0c8, 1.6)
    sunLight.position.set(-40, 30, -80)
    scene.add(sunLight)
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false })
    )
    sun.position.set(-40, 30, -80)
    scene.add(sun)

    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
    const clouds = []
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group()
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2, 12, 12), cloudMat)
        s.position.set(j * 2.4 - 3, Math.random(), Math.random() * 1.5)
        s.scale.y = 0.6
        c.add(s)
      }
      c.position.set((Math.random() - 0.5) * 160, 22 + Math.random() * 10, -30 - Math.random() * 60)
      scene.add(c)
      clouds.push(c)
    }

    // Nhân vật
    const person = makePerson()
    scene.add(person.g)
    person.g.position.set(0, height(0, 0), 0)
    let facing = 0
    let phase = 0

    // Điều khiển: giữ chuột trái (hoặc chạm) để đi tới vị trí con trỏ
    const mouse = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const target = new THREE.Vector3()
    let pressed = false
    let zoom = 1

    const setMouse = (e) => {
      const r = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1
    }
    const onDown = (e) => { pressed = true; setMouse(e) }
    const onMove = (e) => setMouse(e)
    const onUp = () => { pressed = false }
    const onWheel = (e) => {
      e.preventDefault()
      zoom = Math.min(2.5, Math.max(0.5, zoom + e.deltaY * 0.001))
    }
    const dom = renderer.domElement
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('wheel', onWheel, { passive: false })
    addEventListener('pointerup', onUp)
    addEventListener('pointercancel', onUp)

    const clock = new THREE.Clock()
    const camGoal = new THREE.Vector3()
    const look = new THREE.Vector3()
    let t = 0
    let id

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      t += dt
      grassMat.uniforms.uTime.value = t
      clouds.forEach((c) => {
        c.position.x += 0.01
        if (c.position.x > 90) c.position.x = -90
      })

      const p = person.g.position
      let moving = false
      if (pressed) {
        raycaster.setFromCamera(mouse, camera)
        const hit = raycaster.intersectObject(ground)[0]
        if (hit) target.copy(hit.point)
        const dx = target.x - p.x
        const dz = target.z - p.z
        const dist = Math.hypot(dx, dz)
        if (dist > 0.4) {
          const step = Math.min(6 * dt, dist)
          p.x = Math.max(-42, Math.min(42, p.x + (dx / dist) * step))
          p.z = Math.max(-42, Math.min(42, p.z + (dz / dist) * step))
          const want = Math.atan2(dx, dz)
          const diff = ((want - facing + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
          facing += diff * Math.min(1, 10 * dt)
          moving = true
        }
      }
      p.y = height(p.x, p.z)
      person.g.rotation.y = facing

      // Vung tay chân khi đi, về tư thế đứng khi dừng
      phase += moving ? dt * 9 : 0
      const swing = moving ? Math.sin(phase) * 0.8 : 0
      person.legL.rotation.x += (swing - person.legL.rotation.x) * Math.min(1, 12 * dt)
      person.legR.rotation.x += (-swing - person.legR.rotation.x) * Math.min(1, 12 * dt)
      person.armL.rotation.x += (-swing - person.armL.rotation.x) * Math.min(1, 12 * dt)
      person.armR.rotation.x += (swing - person.armR.rotation.x) * Math.min(1, 12 * dt)

      // Camera bám theo sau nhân vật
      camGoal.set(p.x, p.y + 5 * zoom, p.z + 9 * zoom)
      camera.position.lerp(camGoal, 1 - Math.exp(-4 * dt))
      look.set(p.x, p.y + 1.5, p.z)
      camera.lookAt(look)

      renderer.render(scene, camera)
      id = requestAnimationFrame(loop)
    }
    camera.position.set(0, height(0, 0) + 5, 9)
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
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('wheel', onWheel)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={ref} style={{ position: 'fixed', inset: 0 }} />
}