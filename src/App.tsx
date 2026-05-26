import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { DataSnapshot, getDatabase, onValue, ref } from 'firebase/database'
import {
  Chart,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ScriptableContext,
} from 'chart.js'
import './App.css'

type PhaseKey = 'R' | 'S' | 'T'

type PhaseState = {
  phase: PhaseKey
  voltage: number
  current: number
  pfRaw: number
  pf: number
  step: number
  activePower: number
  reactivePower: number
}

const PHASES: PhaseKey[] = ['R', 'S', 'T']
const firebaseConfig = {
  apiKey: import.meta.env.FARHAN_FIREBASE_API_KEY,
  authDomain: import.meta.env.FARHAN_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.FARHAN_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.FARHAN_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.FARHAN_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.FARHAN_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FARHAN_FIREBASE_APP_ID,
  measurementId: import.meta.env.FARHAN_FIREBASE_MEASUREMENT_ID,
}

const firebaseApp = initializeApp(firebaseConfig)
if (import.meta.env.FARHAN_FIREBASE_MEASUREMENT_ID) {
  getAnalytics(firebaseApp)
}
const realtimeDb = getDatabase(firebaseApp)

const STATIC_PF_VALUES = [
  0.76, 0.78, 0.79, 0.8, 0.82, 0.81, 0.83, 0.84, 0.85, 0.84,
  0.86, 0.87, 0.88, 0.86, 0.87, 0.89, 0.9, 0.89, 0.9, 0.91,
  0.9, 0.91, 0.92, 0.91, 0.9, 0.89, 0.9, 0.91, 0.92, 0.91,
]

const STATIC_CURRENT_VALUES = {
  R: [
    1.05, 1.12, 1.18, 1.1, 0.98, 1.04, 1.2, 1.26, 1.18, 1.1, 1.06, 1.12,
    1.24, 1.3, 1.22, 1.14, 1.08, 1.02, 1.12, 1.2, 1.16, 1.08, 1.02, 1.1,
  ],
  S: [
    1.0, 1.06, 1.12, 1.08, 0.96, 1.02, 1.16, 1.22, 1.14, 1.06, 1.02, 1.08,
    1.18, 1.24, 1.16, 1.08, 1.02, 0.98, 1.06, 1.14, 1.1, 1.02, 0.96, 1.04,
  ],
  T: [
    1.08, 1.14, 1.2, 1.12, 1.0, 1.06, 1.22, 1.28, 1.2, 1.12, 1.08, 1.14,
    1.26, 1.32, 1.24, 1.16, 1.1, 1.04, 1.14, 1.22, 1.18, 1.1, 1.04, 1.12,
  ],
}

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
)

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const compensatePf = (pfRaw: number, step: number) =>
  clamp(pfRaw + step * 0.025, 0, 1)

const computePowers = (voltage: number, current: number, pf: number) => {
  const apparent = voltage * current
  const activePower = apparent * pf
  const reactivePower = Math.sqrt(
    Math.max(0, apparent * apparent - activePower * activePower),
  )
  return { activePower, reactivePower }
}

const averagePf = (phases: PhaseState[]) =>
  phases.reduce((sum, phase) => sum + phase.pf, 0) / phases.length

type RealtimePhasePayload = {
  aktif?: unknown
  arus?: unknown
  freq?: unknown
  pf?: unknown
  reaktif?: unknown
  step?: unknown
  tegangan?: unknown
}

type RealtimePayload = Partial<Record<PhaseKey, RealtimePhasePayload>>

const parseNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeRange = (
  value: number | null,
  min: number,
  max: number,
  fallback: number,
) => (value !== null && value >= min && value <= max ? value : fallback)

const createPhaseSeed = (phase: PhaseKey): PhaseState => {
  const voltage = 0
  const current = 0
  const pfRaw = 0
  const pf = 0
  const step = 0
  const { activePower, reactivePower } = computePowers(voltage, current, pf)
  return {
    phase,
    voltage,
    current,
    pfRaw,
    pf,
    step,
    activePower,
    reactivePower,
  }
}

const buildPhaseFromRealtime = (
  phaseKey: PhaseKey,
  payload: RealtimePhasePayload,
  fallback: PhaseState,
): PhaseState => {
  const voltage = normalizeRange(
    parseNumber(payload.tegangan),
    0,
    600,
    fallback.voltage,
  )
  const current = normalizeRange(
    parseNumber(payload.arus),
    0,
    200,
    fallback.current,
  )
  const stepProvided = parseNumber(payload.step)
  const step = stepProvided !== null
    ? clamp(Math.round(stepProvided), 0, 4)
    : fallback.step
  const pfProvided = parseNumber(payload.pf)
  const pfRaw = pfProvided !== null
    ? clamp(pfProvided - step * 0.025, 0, 1)
    : fallback.pfRaw
  const pf = pfProvided !== null
    ? clamp(pfProvided, 0, 1)
    : compensatePf(pfRaw, step)
  const { activePower, reactivePower } = computePowers(voltage, current, pf)
  const activeProvided = parseNumber(payload.aktif)
  const reactiveProvided = parseNumber(payload.reaktif)

  return {
    phase: phaseKey,
    voltage,
    current,
    pfRaw,
    pf,
    step,
    activePower: activeProvided !== null ? activeProvided : activePower,
    reactivePower: reactiveProvided !== null ? reactiveProvided : reactivePower,
  }
}

const mergeRealtime = (
  payload: RealtimePayload | null,
  fallbackPhases: PhaseState[],
) =>
  PHASES.map((phaseKey) => {
    const fallback =
      fallbackPhases.find((phase) => phase.phase === phaseKey) ??
      createPhaseSeed(phaseKey)
    const phasePayload = payload?.[phaseKey]
    if (!phasePayload) {
      return fallback
    }
    return buildPhaseFromRealtime(phaseKey, phasePayload, fallback)
  })

type IconProps = {
  className?: string
}

const IconHome = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 11.5L12 4l9 7.5" />
    <path d="M5 10v9h14v-9" />
  </svg>
)

const IconBolt = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />
  </svg>
)

const IconChart = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 18h16" />
    <path d="M6 16l4-6 4 3 4-7" />
    <circle cx="10" cy="10" r="1" />
    <circle cx="14" cy="13" r="1" />
    <circle cx="18" cy="6" r="1" />
  </svg>
)

const IconPulse = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12h4l3-6 4 12 3-6h4" />
  </svg>
)

const IconShield = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3l7 3v6c0 4.2-2.8 7.9-7 9-4.2-1.1-7-4.8-7-9V6l7-3z" />
  </svg>
)

const IconStack = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3l8 4-8 4-8-4 8-4z" />
    <path d="M4 12l8 4 8-4" />
    <path d="M4 17l8 4 8-4" />
  </svg>
)

const navItems = [
  { label: 'Home', icon: IconHome },
  { label: '3-Phase', icon: IconBolt },
  { label: 'Cos φ', icon: IconChart },
  { label: 'History', icon: IconPulse },
]

function App() {
  const [phases, setPhases] = useState<PhaseState[]>(() =>
    PHASES.map((phase) => createPhaseSeed(phase)),
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Array<HTMLElement | null>>([])
  const pfChartRef = useRef<HTMLCanvasElement | null>(null)
  const currentChartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstances = useRef<{ pf?: Chart; current?: Chart }>({})

  useEffect(() => {
    const realtimeRef = ref(realtimeDb)
    const unsubscribe = onValue(
      realtimeRef,
      (snapshot: DataSnapshot) => {
        const payload = snapshot.val() as RealtimePayload | null
        setPhases((prev) => mergeRealtime(payload, prev))
      },
      () => {
        setPhases((prev) => prev)
      },
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const index = Number(visible.target.getAttribute('data-index') ?? 0)
          setActiveIndex(index)
        }
      },
      { root: container, threshold: [0.5, 0.7, 0.9] },
    )
    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
  }, [])

  const pfLabels = useMemo(
    () => STATIC_PF_VALUES.map((_, index) => `${index + 1}`),
    [],
  )
  const currentLabels = useMemo(
    () => STATIC_CURRENT_VALUES.R.map((_, index) => `${index + 1}`),
    [],
  )

  useEffect(() => {
    const pfCanvas = pfChartRef.current
    const currentCanvas = currentChartRef.current
    if (!pfCanvas || !currentCanvas) return

    const pfCtx = pfCanvas.getContext('2d')
    const currentCtx = currentCanvas.getContext('2d')
    if (!pfCtx || !currentCtx) return

    chartInstances.current.pf?.destroy()
    chartInstances.current.current?.destroy()

    const gridColor = 'rgba(18, 60, 40, 0.08)'
    const axisColor = 'rgba(18, 60, 40, 0.2)'
    const tickColor = 'rgba(35, 70, 55, 0.7)'
    const endPointRadius = (lastIndex: number) =>
      (ctx: ScriptableContext<'line'>) =>
        ctx.dataIndex === lastIndex ? 3 : 0

    const pfLastIndex = STATIC_PF_VALUES.length - 1
    chartInstances.current.pf = new Chart(pfCtx, {
      type: 'line',
      data: {
        labels: pfLabels,
        datasets: [
          {
            label: 'Cos phi (avg)',
            data: STATIC_PF_VALUES,
            borderColor: '#1f8f5f',
            backgroundColor: 'rgba(31, 143, 95, 0.16)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.4,
            pointRadius: endPointRadius(pfLastIndex),
            pointHoverRadius: 4,
            pointBackgroundColor: '#5acc9a',
            pointBorderColor: '#edf6f0',
            pointBorderWidth: 1,
          },
          {
            label: 'Threshold 0.85',
            data: STATIC_PF_VALUES.map(() => 0.85),
            borderColor: 'rgba(242, 164, 82, 0.75)',
            borderWidth: 1.2,
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(230, 244, 234, 0.96)',
            borderColor: 'rgba(24, 122, 83, 0.25)',
            borderWidth: 1,
            titleColor: '#0f1f18',
            bodyColor: '#4b6256',
          },
        },
        scales: {
          x: {
            grid: { color: gridColor, tickColor: gridColor },
            border: { color: axisColor },
            ticks: { color: tickColor, maxTicksLimit: 6, font: { size: 10 } },
          },
          y: {
            min: 0.4,
            max: 1.0,
            grid: { color: gridColor, tickColor: gridColor },
            border: { color: axisColor },
            ticks: { color: tickColor, maxTicksLimit: 5, font: { size: 10 } },
          },
        },
      },
    })

    const currentLastIndex = currentLabels.length - 1
    const currentValues = [
      ...STATIC_CURRENT_VALUES.R,
      ...STATIC_CURRENT_VALUES.S,
      ...STATIC_CURRENT_VALUES.T,
    ]
    const currentMin = Math.min(...currentValues)
    const currentMax = Math.max(...currentValues)

    chartInstances.current.current = new Chart(currentCtx, {
      type: 'line',
      data: {
        labels: currentLabels,
        datasets: [
          {
            label: 'Phase R',
            data: STATIC_CURRENT_VALUES.R,
            borderColor: '#d96262',
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: endPointRadius(currentLastIndex),
            pointHoverRadius: 4,
            pointBackgroundColor: '#f3a1a1',
            pointBorderColor: '#fff4f4',
            pointBorderWidth: 1,
          },
          {
            label: 'Phase S',
            data: STATIC_CURRENT_VALUES.S,
            borderColor: '#1f8f5f',
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: endPointRadius(currentLastIndex),
            pointHoverRadius: 4,
            pointBackgroundColor: '#5acc9a',
            pointBorderColor: '#edf6f0',
            pointBorderWidth: 1,
          },
          {
            label: 'Phase T',
            data: STATIC_CURRENT_VALUES.T,
            borderColor: '#f2a452',
            borderWidth: 2.2,
            tension: 0.35,
            pointRadius: endPointRadius(currentLastIndex),
            pointHoverRadius: 4,
            pointBackgroundColor: '#f7c079',
            pointBorderColor: '#fff6ea',
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(230, 244, 234, 0.96)',
            borderColor: 'rgba(24, 122, 83, 0.25)',
            borderWidth: 1,
            titleColor: '#0f1f18',
            bodyColor: '#4b6256',
          },
        },
        scales: {
          x: {
            grid: { color: gridColor, tickColor: gridColor },
            border: { color: axisColor },
            ticks: { color: tickColor, maxTicksLimit: 6, font: { size: 10 } },
          },
          y: {
            min: currentMin * 0.9,
            max: currentMax * 1.1,
            grid: { color: gridColor, tickColor: gridColor },
            border: { color: axisColor },
            ticks: { color: tickColor, maxTicksLimit: 5, font: { size: 10 } },
          },
        },
      },
    })

    return () => {
      chartInstances.current.pf?.destroy()
      chartInstances.current.current?.destroy()
    }
  }, [pfLabels, currentLabels])

  const avgPf = useMemo(
    () => averagePf(phases),
    [phases],
  )
  const totalSteps = useMemo(
    () => phases.reduce((sum, phase) => sum + phase.step, 0),
    [phases],
  )
  const balanceStatus = useMemo(() => {
    const currents = phases.map((phase) => phase.current)
    const imbalance = Math.max(...currents) - Math.min(...currents)
    return imbalance < 0.35
      ? { label: 'Balanced', tone: 'good' }
      : imbalance < 0.8
        ? { label: 'Moderate unbalance', tone: 'warn' }
        : { label: 'High unbalance', tone: 'bad' }
  }, [phases])

  const pfSummary = useMemo(() => {
    const values = STATIC_PF_VALUES
    const last = values[values.length - 1] ?? 0
    const prev = values[values.length - 2] ?? last
    const delta = prev ? ((last - prev) / prev) * 100 : 0
    return { value: last, delta, isUp: delta >= 0 }
  }, [])

  const currentSummary = useMemo(() => {
    const lastIndex = STATIC_CURRENT_VALUES.R.length - 1
    const prevIndex = Math.max(0, lastIndex - 1)
    const lastAvg =
      (STATIC_CURRENT_VALUES.R[lastIndex] +
        STATIC_CURRENT_VALUES.S[lastIndex] +
        STATIC_CURRENT_VALUES.T[lastIndex]) /
      3
    const prevAvg =
      (STATIC_CURRENT_VALUES.R[prevIndex] +
        STATIC_CURRENT_VALUES.S[prevIndex] +
        STATIC_CURRENT_VALUES.T[prevIndex]) /
      3
    const delta = prevAvg ? ((lastAvg - prevAvg) / prevAvg) * 100 : 0
    return { value: lastAvg, delta, isUp: delta >= 0 }
  }, [])

  const handleNavClick = useCallback((index: number) => {
    const section = sectionRefs.current[index]
    if (!section || !containerRef.current) return
    containerRef.current.scrollTo({
      top: section.offsetTop,
      behavior: 'smooth',
    })
  }, [])

  return (
    <div className="app">
      <div className="bg">
        <div className="ambient ambient-1" />
        <div className="ambient ambient-2" />
        <svg
          className="bg-lines"
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1f8f5f" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#6bcf8d" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#b7e2a2" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path
            className="line-path"
            d="M-120,120 L1320,-120"
          />
          <path
            className="line-path slow"
            d="M-120,320 L1320,80"
          />
          <path
            className="line-path"
            d="M-120,520 L1320,280"
          />
          <path
            className="line-path subtle"
            d="M-120,720 L1320,480"
          />
        </svg>
      </div>

      <div className="snap-container" ref={containerRef}>
        <section
          className="screen"
          id="overview"
          data-index={0}
          ref={(el) => {
            sectionRefs.current[0] = el
          }}
        >
          <div className="container">
            <div className="hero-card glass-card">
              <div className="hero-top">
                <span className="hero-icon">
                  <IconShield />
                </span>
                <span className="badge">Laboratorium Teknik Elektro</span>
              </div>
              <h1 className="hero-title">Kompensator Daya Reaktif</h1>
              <p className="hero-subtitle">
                Sistem Pengendalian Adaptif & Monitoring Real-time.
              </p>
              <div className="hero-metrics">
                <div className="metric-card">
                  <p className="metric-label">Target PF</p>
                  <p className="metric-value">0.92</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Capacity</p>
                  <p className="metric-value">19.2 MVAR</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Efficiency</p>
                  <p className="metric-value">98.2%</p>
                </div>
              </div>
              <div className="hero-footer">
                <span className="pill">By Farhan Ramadhani Nugraha</span>
                <span className="pill muted">Smart SCADA System</span>
              </div>
            </div>

            <div className="overview-grid">
              <div className="glass-card reveal" style={{ animationDelay: '60ms' }}>
                <div className="card-head">
                    <span className="icon-tile">
                      <IconBolt className="card-icon" />
                    </span>
                  <h3>Real time correction</h3>
                </div>
                <p>
                  Automatic step control keeps cos phi steady while reducing
                  current stress during load shifts.
                </p>
                <div className="tag-row">
                  <span className="tag">Auto steps</span>
                  <span className="tag">PF guard</span>
                </div>
              </div>
              <div
                className="glass-card reveal"
                style={{ animationDelay: '120ms' }}
              >
                <div className="card-head">
                  <span className="icon-tile">
                    <IconStack className="card-icon" />
                  </span>
                  <h3>Cap bank intelligence</h3>
                </div>
                <p>
                  Phase diagnostics, reactive power tracking, and compact
                  monitoring for all four steps per phase.
                </p>
                <div className="tag-row">
                  <span className="tag">3 phase</span>
                  <span className="tag">4 step</span>
                </div>
              </div>
              <div
                className="glass-card reveal"
                style={{ animationDelay: '180ms' }}
              >
                <div className="card-head">
                  <span className="icon-tile">
                    <IconChart className="card-icon" />
                  </span>
                  <h3>Trusted telemetry</h3>
                </div>
                <p>
                  Clean dashboards built for operators, with a durable brand
                  tone and SCADA grade clarity.
                </p>
                <div className="tag-row">
                  <span className="tag">IoT cloud</span>
                  <span className="tag">Audit trail</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="screen"
          id="phases"
          data-index={1}
          ref={(el) => {
            sectionRefs.current[1] = el
          }}
        >
          <div className="container">
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  <span className="icon-tile compact">
                    <IconBolt className="title-icon" />
                  </span>
                  Three phase status
                </h2>
                <p className="section-subtitle">
                  Live electrical balance with capacitor step visibility.
                </p>
              </div>
              <span className="badge">Live stream</span>
            </div>

            <div className="phase-grid">
              {phases.map((phase) => {
                const pfTone =
                  phase.pf >= 0.85
                    ? 'good'
                    : phase.pf >= 0.7
                      ? 'warn'
                      : 'bad'
                return (
                  <div className="glass-card phase-card" key={phase.phase}>
                    <div className="phase-top">
                      <h3>Phase {phase.phase}</h3>
                      <span className={`status-pill ${pfTone}`}>
                        PF {phase.pf.toFixed(3)}
                      </span>
                    </div>
                    <div className="phase-metrics">
                      <div>
                        <p className="metric-label">Voltage</p>
                        <p className="metric-value">
                          {phase.voltage.toFixed(1)} V
                        </p>
                      </div>
                      <div>
                        <p className="metric-label">Current</p>
                        <p className="metric-value">
                          {phase.current.toFixed(2)} A
                        </p>
                      </div>
                      <div>
                        <p className="metric-label">Active</p>
                        <p className="metric-value">
                          {Math.round(phase.activePower)} W
                        </p>
                      </div>
                      <div>
                        <p className="metric-label">Reactive</p>
                        <p className="metric-value">
                          {Math.round(phase.reactivePower)} VAR
                        </p>
                      </div>
                    </div>
                    <div className="step-row">
                      <span>Capacitor steps</span>
                      <strong>{phase.step}/4</strong>
                    </div>
                    <div className="step-dots">
                      {Array.from({ length: 4 }, (_, index) => (
                        <span
                          key={index}
                          className={`step-dot ${
                            index < phase.step ? 'active' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="summary-card glass-card">
              <div>
                <p className="metric-label">System average PF</p>
                <p className="value-large">{avgPf.toFixed(3)}</p>
              </div>
              <div>
                <p className="metric-label">Total active steps</p>
                <p className="value-large">{totalSteps} / 12</p>
              </div>
              <div>
                <p className="metric-label">Load balance</p>
                <span className={`status-pill ${balanceStatus.tone}`}>
                  {balanceStatus.label}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="screen"
          id="bank"
          data-index={2}
          ref={(el) => {
            sectionRefs.current[2] = el
          }}
        >
          <div className="container">
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  <span className="icon-tile compact">
                    <IconStack className="title-icon" />
                  </span>
                  Capacitor Bank and Power Factor
                </h2>
                <p className="section-subtitle">
                  Real time compensation status with trend visibility.
                </p>
              </div>
              <span className="badge">Threshold 0.85</span>
            </div>

            <div className="cap-grid">
              {phases.map((phase) => (
                <div className="glass-card cap-card" key={phase.phase}>
                  <div className="cap-top">
                    <span className="cap-label">Phase {phase.phase}</span>
                    <span
                      className={`status-pill ${
                        phase.step > 0 ? 'good' : 'muted'
                      }`}
                    >
                      {phase.step > 0 ? 'Compensating' : 'Standby'}
                    </span>
                  </div>
                  <p className="cap-pf">{phase.pf.toFixed(3)}</p>
                  <div className="step-dots center">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span
                        key={index}
                        className={`step-dot ${
                          index < phase.step ? 'active' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <p className="cap-meta">Active steps {phase.step}/4</p>
                </div>
              ))}
            </div>

            <div className="glass-card chart-card">
              <div className="chart-header">
                <div>
                  <h5 className="chart-stat">{pfSummary.value.toFixed(3)}</h5>
                  <p className="chart-subtitle">Power factor average</p>
                </div>
                <span className={`chart-delta ${pfSummary.isUp ? 'up' : 'down'}`}>
                  <svg
                    className="delta-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="m6 11 6-6 6 6" />
                  </svg>
                  {Math.abs(pfSummary.delta).toFixed(1)}%
                </span>
              </div>
              <div className="chart-surface">
                <canvas
                  ref={pfChartRef}
                  className="chart-canvas"
                  role="img"
                  aria-label="Power factor chart"
                />
              </div>
              <div className="chart-footer">
                <button type="button" className="chart-button">
                  Last 7 days
                  <svg
                    className="footer-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <button type="button" className="chart-link">
                  Progress report
                  <svg
                    className="footer-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          className="screen"
          id="history"
          data-index={3}
          ref={(el) => {
            sectionRefs.current[3] = el
          }}
        >
          <div className="container">
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  <span className="icon-tile compact">
                    <IconPulse className="title-icon" />
                  </span>
                  Current monitoring history
                </h2>
                <p className="section-subtitle">
                  Rolling day view for phase currents and operational variance.
                </p>
              </div>
              <span className="badge">Daily trend</span>
            </div>

            <div className="glass-card chart-card">
              <div className="chart-header">
                <div>
                  <h5 className="chart-stat">
                    {currentSummary.value.toFixed(2)} A
                  </h5>
                  <p className="chart-subtitle">Average phase current</p>
                </div>
                <span
                  className={`chart-delta ${
                    currentSummary.isUp ? 'up' : 'down'
                  }`}
                >
                  <svg
                    className="delta-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="m6 11 6-6 6 6" />
                  </svg>
                  {Math.abs(currentSummary.delta).toFixed(1)}%
                </span>
              </div>
              <div className="chart-surface">
                <canvas
                  ref={currentChartRef}
                  className="chart-canvas"
                  role="img"
                  aria-label="Phase current chart"
                />
              </div>
              <div className="legend">
                <div>
                  <span className="legend-dot r" />
                  <span>Phase R</span>
                </div>
                <div>
                  <span className="legend-dot s" />
                  <span>Phase S</span>
                </div>
                <div>
                  <span className="legend-dot t" />
                  <span>Phase T</span>
                </div>
              </div>
              <div className="chart-footer">
                <button type="button" className="chart-button">
                  Last 24 hours
                  <svg
                    className="footer-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <button type="button" className="chart-link">
                  Progress report
                  <svg
                    className="footer-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="bottom-nav" role="navigation" aria-label="Quick navigator">
        {navItems.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${activeIndex === index ? 'active' : ''}`}
              onClick={() => handleNavClick(index)}
            >
              <Icon className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default App
