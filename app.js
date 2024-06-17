import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// Constantes
const k = 8.99e9 // Constante de Coulomb en N·m²/C²

// Valores de las cargas y sus posiciones
let q1 = 1e-6 // 1 microcoulomb
let r1 = [0, 0, 0] // Posición de la primera carga
let q2 = -1e-6 // -1 microcoulomb
let r2 = [2, 0, 0] // Posición de la segunda carga

let cargas = [
  [q1, r1],
  [q2, r2],
]

let numPuntos = 5
let numAngulos = 5
let numFlechas = 5

let COLORS = {
  carga1: 0x0000ff,
  carga2: 0xff0000,
  curves: 0x00ff00,
}

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

function createSphere(color, position, radius) {
  const geometry = new THREE.SphereGeometry(radius, 32, 32)
  const material = new THREE.MeshBasicMaterial({ color: color })
  const sphere = new THREE.Mesh(geometry, material)
  sphere.position.set(...position)
  scene.add(sphere)
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
  let campo = [0, 0];

  // Iterar sobre cada carga en la lista de cargas
  for (const carga of cargas) {
    // Descomponer la carga en su magnitud q y su posición [rx, ry]
    const [q, r] = carga;
    const [x, y] = punto;
    const [rx, ry] = r;

    // Calcular las diferencias de posición entre el punto y la carga
    const dx = x - rx;
    const dy = y - ry;

    // Calcular la distancia al cuadrado entre el punto y la carga
    const r2 = dx * dx + dy * dy;

    // r3 = (r^2)^(3/2)
    const r3 = Math.pow(r2, 1.5);
    const coef = (k * q) / r3;

    // Calcular las componentes del campo eléctrico y sumarlas al campo total
    campo[0] += coef * dx;
    campo[1] += coef * dy;
  }

  // Devolver el campo eléctrico total en el punto
  return campo;
}

// Función para calcular la trayectoria de una línea de campo en una dirección
function calcularTrayectoria(
  puntoInicial,
  cargas,
  direccion = 1,
  paso = 0.01,
  maxIteraciones = 1000
) {
  let trayectoria = [puntoInicial]
  let punto = puntoInicial

  for (let i = 0; i < maxIteraciones; i++) {
    const campo = calcularCampo(punto, cargas)
    const magnitud = Math.sqrt(campo[0] * campo[0] + campo[1] * campo[1])
    const pasoNormalizado = [
      (campo[0] / magnitud) * paso * direccion,
      (campo[1] / magnitud) * paso * direccion,
    ]
    punto = [punto[0] + pasoNormalizado[0], punto[1] + pasoNormalizado[1]]
    trayectoria.push(punto)
    
    // Detener si el punto está muy cerca de una carga
    const cargaObjetivo = direccion === 1 ? cargas[1] : cargas[0]
    const [q, r] = cargaObjetivo
    const dx = punto[0] - r[0]
    const dy = punto[1] - r[1]
    if (Math.sqrt(dx * dx + dy * dy) < paso) {
      return trayectoria
    }
  }
  return trayectoria
}

// Función para calcular múltiples líneas de campo en 2D en ambas direcciones
function calcularLineasCampo2D(
  cargas,
  puntosIniciales,
  paso = 0.01,
  maxIteraciones = 8000
) {
  const lineasCampo = []

  for (const puntoInicial of puntosIniciales) {
    const trayectoriaAdelante = calcularTrayectoria(
      puntoInicial,
      cargas,
      1,
      paso,
      maxIteraciones
    )
    const trayectoriaAtras = calcularTrayectoria(
      puntoInicial,
      cargas,
      -1,
      paso,
      maxIteraciones
    )
    lineasCampo.push([
      ...trayectoriaAtras.reverse(),
      ...trayectoriaAdelante.slice(1),
    ])
  }

  return lineasCampo
}

// Función para rotar un punto alrededor de un eje
function rotarPuntoAlrededorEje(punto, eje, angulo) {
  const [x, y, z] = punto;
  const [ux, uy, uz] = eje;
  const cosA = Math.cos(angulo);
  const sinA = Math.sin(angulo);
  const dotProduct = ux * x + uy * y + uz * z;

  const rx = cosA * x + sinA * (uy * z - uz * y) + (1 - cosA) * dotProduct * ux;
  const ry = cosA * y + sinA * (uz * x - ux * z) + (1 - cosA) * dotProduct * uy;
  const rz = cosA * z + sinA * (ux * y - uy * x) + (1 - cosA) * dotProduct * uz;

  return [rx, ry, rz];
}

// Función para generar las trayectorias en 3D rotando las trayectorias 2D
function generarTrayectorias3D(lineasCampo2D, eje, numAngulos = 12) {
  const trayectorias3D = [];
  for (const trayectoria2D of lineasCampo2D) {
      for (let i = 0; i < numAngulos; i++) {
          const angulo = (i / numAngulos) * 2 * Math.PI;
          const trayectoria3D = trayectoria2D.map(punto => rotarPuntoAlrededorEje([punto[0], punto[1], 0], eje, angulo));
          trayectorias3D.push(trayectoria3D);
      }
  }

  return trayectorias3D;
}

// Función para agregar flechas a la trayectoria
function addArrowsToTrajectory(trayectoria, color, numFlechas) {
  const arrowSize = 0.4;
  const arrowHelperObjects = [];
  const interval = Math.floor(trayectoria.length / numFlechas);

  for (let i = 0; i < trayectoria.length - 1 && arrowHelperObjects.length < numFlechas; i += interval) {
    const startPoint = new THREE.Vector3(...trayectoria[i]);
    const endPoint = new THREE.Vector3(...trayectoria[i + 1]);
    const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();

    const arrowHelper = new THREE.ArrowHelper(direction, startPoint, arrowSize, color);
    arrowHelperObjects.push(arrowHelper);
  }

  return arrowHelperObjects;
}

function updateScene() {
  // Limpiar la escena
  while (scene.children.length > 0) {
    scene.remove(scene.children[0])
  }

  // Crear esferas para representar las cargas
  createSphere(COLORS.carga1, r1, 0.15)
  createSphere(COLORS.carga2, r2, 0.15)

  // Puntos iniciales en un círculo alrededor de ambas cargas
  const puntosIniciales = []
  const radio = 0.1

  // Puntos alrededor de la primera carga
  for (let i = 0; i < numPuntos; i++) {
    const angulo = (i / numPuntos) * 2 * Math.PI
    puntosIniciales.push([
      r1[0] + radio * Math.cos(angulo),
      r1[1] + radio * Math.sin(angulo),
    ])
  }

  // Puntos alrededor de la segunda carga
  for (let i = 0; i < numPuntos; i++) {
    const angulo = (i / numPuntos) * 2 * Math.PI
    puntosIniciales.push([
      r2[0] + radio * Math.cos(angulo),
      r2[1] + radio * Math.sin(angulo),
    ])
  }

  // Eje de rotación (normalizado)
  const dx = r2[0] - r1[0];
  const dy = r2[1] - r1[1];
  const dz = 0;
  const longitudEje = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ejeRotacion = [dx / longitudEje, dy / longitudEje, dz / longitudEje];

  const lineasCampo2D  = calcularLineasCampo2D(cargas, puntosIniciales)

  // Generar trayectorias en 3D
  const trayectorias3D = generarTrayectorias3D(lineasCampo2D, ejeRotacion, numAngulos);

  // Crear curvas usando la función createCurve y agregar flechas
  for (const controlPoints of trayectorias3D) {
    const curva = createCurve(COLORS.curves, controlPoints);
    scene.add(curva);

    const arrowHelpers = addArrowsToTrajectory(controlPoints, COLORS.curves, numFlechas);
    arrowHelpers.forEach(arrowHelper => scene.add(arrowHelper));
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

// Formulario para actualizar los valores
const configForm = document.getElementById('configForm');
configForm.addEventListener('submit', (event) => {
  event.preventDefault();

  // Actualizar colores
  COLORS.carga1 = parseInt(document.getElementById('carga1Color').value.substring(1), 16);
  COLORS.carga2 = parseInt(document.getElementById('carga2Color').value.substring(1), 16);
  COLORS.curves = parseInt(document.getElementById('curvesColor').value.substring(1), 16);

  // Actualizar cargas y posiciones
  q1 = parseFloat(document.getElementById('q1').value);
  q2 = parseFloat(document.getElementById('q2').value);
  r2[0] = parseFloat(document.getElementById('r2x').value)
  r2[1] = parseFloat(document.getElementById('r2y').value)
  cargas = [
    [q1, r1],
    [q2, r2]
  ];

  // Actualizar número de puntos y ángulos
  numPuntos = parseInt(document.getElementById('numPuntos').value);
  numAngulos = parseInt(document.getElementById('numAngulos').value);
  numFlechas = parseInt(document.getElementById('numFlechas').value);

  // Actualizar la escena
  updateScene();
});

// Inicializar la escena con los valores iniciales
updateScene();
