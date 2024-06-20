import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// Constantes
const k = 8.99e9 // Constante de Coulomb en N·m²/C²

let nextChargeID = 0
let cargas = []

let numPuntos2D = 6
let numPlanos = 6
let numFlechas = 2

const COLORS = {
  positiveCharge: 0x0000ff,
  negativeCharge: 0xff0000,
}

const COLORS_LIST = [
  0x0000ff, 0xff0000, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000,
  0x8000ff, 0x00ff80, 0x80ff00, 0xff0080,
]

// Escena, cámara y renderizador
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
})
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

function createSphere(position, radius, color) {
  const geometry = new THREE.SphereGeometry(radius, 32, 32)
  const material = new THREE.MeshBasicMaterial({ color: color })
  const sphere = new THREE.Mesh(geometry, material)
  sphere.position.set(...position)
  scene.add(sphere)
}

function createCharge(cargaNum, radius) {
  const color = cargas[cargaNum][0] > 0 ? COLORS.positiveCharge : COLORS.negativeCharge
  const position = cargas[cargaNum][1]
  createSphere(position, radius, color)
}

// Función para crear una curva
function createCurve(color, controlPoints) {
  const curvePath = new THREE.CurvePath()

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const startPoint = new THREE.Vector3(...controlPoints[i])
    const endPoint = new THREE.Vector3(...controlPoints[i + 1])
    curvePath.add(new THREE.LineCurve3(startPoint, endPoint))
  }

  const points = curvePath.getPoints(50)
  const curveGeometry = new THREE.BufferGeometry().setFromPoints(points)
  const curveMaterial = new THREE.LineBasicMaterial({ color: color })

  return new THREE.Line(curveGeometry, curveMaterial)
}

// Función para calcular el campo eléctrico en un punto dado por varias cargas
function calcularCampo(punto, cargas) {
  // Inicializar el campo eléctrico en el punto como un vector de dos componentes [Ex, Ey]
  let campo = [0, 0, 0]

  // Iterar sobre cada carga en la lista de cargas
  for (const carga of cargas) {
    // Descomponer la carga en su magnitud q y su posición [rx, ry]
    const [q, r] = carga
    const [x, y, z] = punto
    const [rx, ry, rz] = r

    // Calcular las diferencias de posición entre el punto y la carga
    const dx = x - rx
    const dy = y - ry
    const dz = z - rz

    // Calcular la distancia al cuadrado entre el punto y la carga
    const r2 = dx * dx + dy * dy + dz * dz

    // Calcular el campo eléctrico en 3d en el punto debido a la carga
    const E = (k * q) / r2

    // Calcular las componentes del campo eléctrico en el punto debido a la carga
    const Ex = (E * dx) / Math.sqrt(r2)
    const Ey = (E * dy) / Math.sqrt(r2)
    const Ez = (E * dz) / Math.sqrt(r2)

    // Sumar las componentes del campo eléctrico en el punto
    campo[0] += Ex
    campo[1] += Ey
    campo[2] += Ez
  }

  // Devolver el campo eléctrico total en el punto
  return campo
}

function distancia(p1, p2) {
  const dx = p1[0] - p2[0]
  const dy = p1[1] - p2[1]
  const dz = p1[2] - p2[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Función para calcular la trayectoria de una línea de campo en una dirección
function calcularTrayectoria(
  puntoInicial,
  cargas,
  direccion = 1,
  cargaOrigen,
  paso = 0.01,
  maxIteraciones = 1000
) {
  let trayectoria = [puntoInicial]
  let punto = puntoInicial

  const yaAlcanzados = [cargaOrigen]

  for (let _ = 0; _ < maxIteraciones; _++) {
    const campo = calcularCampo(punto, cargas)
    const magnitud = Math.sqrt(
      campo[0] * campo[0] + campo[1] * campo[1] + campo[2] * campo[2]
    )
    const pasoNormalizado = [
      (campo[0] / magnitud) * paso * direccion,
      (campo[1] / magnitud) * paso * direccion,
      (campo[2] / magnitud) * paso * direccion,
    ]
    punto = [
      punto[0] + pasoNormalizado[0],
      punto[1] + pasoNormalizado[1],
      punto[2] + pasoNormalizado[2],
    ]
    trayectoria.push(punto)

    for (let j = 0; j < cargas.length; j++) {
      if (yaAlcanzados.includes(j)) {
        continue
      }
      const carga = cargas[j]
      if (distancia(punto, carga[1]) < paso) {
        yaAlcanzados.push(j)
        if (yaAlcanzados.length === cargas.length) {
          return trayectoria
        }
      }
    }
  }

  return trayectoria
}

// Función para calcular múltiples líneas de campo en 3D en ambas direcciones
function calcularLineasCampo3D(
  cargas,
  puntosIniciales,
  cargaOrigen,
  paso = 0.01,
  maxIteraciones = 8000
) {
  const lineasCampo = []
  const direccion = cargas[cargaOrigen][0] > 0 ? 1 : -1

  for (const puntoInicial of puntosIniciales) {
    const trayectoria = calcularTrayectoria(
      puntoInicial,
      cargas,
      direccion,
      cargaOrigen,
      paso,
      maxIteraciones
    )
    lineasCampo.push(trayectoria)
  }
  return lineasCampo
}

// Función para agregar flechas a la trayectoria
function addArrowsToTrajectory(trayectoria, color, numFlechas, direccion) {
  const arrowSize = 0.2
  const headLength = 0.2
  const headWidth = 0.1
  const arrowHelperObjects = []
  const interval = Math.floor(trayectoria.length / numFlechas + 1)

  for (
    let i = interval;
    i < trayectoria.length - 1 && arrowHelperObjects.length < numFlechas;
    i += interval
  ) {
    const startPoint = new THREE.Vector3(...trayectoria[i])
    const endPoint = new THREE.Vector3(...trayectoria[i + 1])
    const direction = new THREE.Vector3()
      .subVectors(
        direccion == 1 ? endPoint : startPoint,
        direccion == 1 ? startPoint : endPoint
      )
      .normalize()
    if (numFlechas !== 0) {
      const arrowHelper = new THREE.ArrowHelper(
        direction,
        startPoint,
        arrowSize,
        color,
        headLength,
        headWidth
      )
      arrowHelperObjects.push(arrowHelper)
    }
  }

  return arrowHelperObjects
}

function updateScene() {
  // Limpiar la escena
  while (scene.children.length > 0) {
    scene.remove(scene.children[0])
  }

  // Crear esferas para representar las cargas
  for (let i = 0; i < cargas.length; i++) {
    createCharge(i, 0.15)
  }

  const lineasCampo3D = []
  // Puntos iniciales en un círculo alrededor de las cargas
  const radio = 0.1
  for (let j = 0; j < cargas.length; j++) {
    const puntosIniciales = []
    for (let i = 0; i < numPuntos2D; i++) {
      for (let k = 0; k < numPlanos; k++) {
        const theta = (i / numPuntos2D) * 2 * Math.PI
        const phi = (k / numPlanos) * Math.PI
        const x = cargas[j][1][0] + radio * Math.sin(theta) * Math.cos(phi)
        const y = cargas[j][1][1] + radio * Math.sin(theta) * Math.sin(phi)
        const z = cargas[j][1][2] + radio * Math.cos(theta)
        puntosIniciales.push([x, y, z])
      }
    }

    // Graficar puntos iniciales
    for (const punto of puntosIniciales) {
      createSphere(punto, 0.01, 0xffffff)
    }

    lineasCampo3D.push([
      calcularLineasCampo3D(cargas, puntosIniciales, j),
      cargas[j][0] > 0 ? 1 : -1,
    ])
  }

  // Crear curvas usando la función createCurve y agregar flechas
  for (let i = 0; i < lineasCampo3D.length; i++) {
    const controlPointsList = lineasCampo3D[i][0]
    const direccion = lineasCampo3D[i][1]
    const color = COLORS_LIST[i % COLORS_LIST.length]
    for (const controlPoints of controlPointsList) {
      const curva = createCurve(color, controlPoints)
      scene.add(curva)

      const arrowHelpers = addArrowsToTrajectory(
        controlPoints,
        color,
        numFlechas,
        direccion
      )
      arrowHelpers.forEach((arrowHelper) => scene.add(arrowHelper))
    }
  }
}

// Posición de la cámara
camera.position.set(0, 2, 10)
camera.lookAt(0, 0, 0)

// Control de órbita
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true // Suaviza el movimiento
controls.dampingFactor = 0.25
controls.screenSpacePanning = false
controls.minDistance = 2
controls.maxDistance = 20
controls.maxPolarAngle = Math.PI / 2

// Animación
function animate() {
  requestAnimationFrame(animate)

  controls.update() // Actualiza los controles

  renderer.render(scene, camera)
}

animate()

// Ajustar el tamaño del renderizador cuando la ventana cambia de tamaño
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
})

const chargeInputsContainer = document.getElementById('chargeInputsContainer')
const numPuntos2DInput = document.getElementById('numPuntos2D')
const numPlanosInput = document.getElementById('numPlanos')
const numFlechasInput = document.getElementById('numFlechas')

numPuntos2DInput.value = numPuntos2D
numPlanosInput.value = numPlanos
numFlechasInput.value = numFlechas

function updateCharge(chargeID) {
  const chargeDiv = document.getElementById(`chargeDiv${chargeID}`)
  const cargaInput = chargeDiv.getElementsByClassName('cargaInput')[0]
  const positionInputs = chargeDiv.getElementsByClassName('positionInput')
  const position = [
    parseFloat(positionInputs[0].value),
    parseFloat(positionInputs[1].value),
    parseFloat(positionInputs[2].value),
  ]
  const carga = parseFloat(cargaInput.value)
  cargas[chargeID] = [carga, position, chargeID]
  updateScene()
}

function updateNumPuntos2D() {
  numPuntos2D = parseInt(numPuntos2DInput.value)
  updateScene()
}

function updateNumPlanos() {
  numPlanos = parseInt(numPlanosInput.value)
  updateScene()
}

function updateNumFlechas() {
  numFlechas = parseInt(numFlechasInput.value)
  updateScene()
}

numPuntos2DInput.addEventListener('change', updateNumPuntos2D)
numPlanosInput.addEventListener('change', updateNumPlanos)
numFlechasInput.addEventListener('change', updateNumFlechas)

const showFormBtn = document.getElementById('showFormBtn')
showFormBtn.addEventListener('click', () => {
  configForm.style.display =
    configForm.style.display === 'none' ? 'block' : 'none'
  showFormBtn.textContent =
    configForm.style.display === 'none'
      ? 'Mostrar formulario'
      : 'Ocultar formulario'
})

const addCharge = (value = 1, position = [0, 0, 0]) => {
  // TODO: Add support to color auto
  const chargeID = nextChargeID++
  const chargeDiv = document.createElement('div')
  chargeDiv.id = `chargeDiv${chargeID}`
  chargeDiv.style.display = 'flex'
  chargeDiv.style.flexDirection = 'row'

  const cargaInput = document.createElement('input')
  cargaInput.className = 'cargaInput'
  cargaInput.type = 'number'
  cargaInput.name = 'carga'
  cargaInput.value = value
  cargaInput.step = '0.1'
  chargeDiv.appendChild(cargaInput)

  const positionInputs = ['x', 'y', 'z']

  for (let i = 0; i < positionInputs.length; i++) {
    const positionInput = document.createElement('input')
    positionInput.className = 'positionInput'
    positionInput.type = 'number'
    positionInput.name = positionInputs[i]
    positionInput.value = position[i]
    chargeDiv.appendChild(positionInput)
  }

  chargeDiv.addEventListener('change', () => updateCharge(chargeID))

  const deleteBtn = document.createElement('button')
  deleteBtn.type = 'button'
  deleteBtn.className = 'deleteBtn'
  deleteBtn.textContent = 'X'
  deleteBtn.addEventListener('click', () => {
    cargas = cargas.filter((carga) => carga[2] !== chargeID)
    chargeDiv.remove()
    updateScene()
  })
  chargeDiv.appendChild(deleteBtn)

  cargas.push([1e-6, [0, 0, 0], chargeID])
  chargeInputsContainer.appendChild(chargeDiv)
  updateScene()
}

const addChargeBtn = document.getElementById('addChargeBtn')
addChargeBtn.addEventListener('click', () => addCharge())

// Inicializar la escena con los valores iniciales
updateScene()
