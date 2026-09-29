import { useEffect, useState, type FormEvent } from 'react'
import { api, type Task, type User } from './lib/api'

type Page = 'home' | 'login' | 'register' | 'dashboard'

function formatDate(value: string | null) {
  if (!value) return 'Recently'
  return new Date(value).toLocaleString()
}

function App() {
  const [page, setPage] = useState<Page>(
    api.getToken() ? 'dashboard' : 'home',
  )
  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [taskInput, setTaskInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (page !== 'dashboard') return

    let cancelled = false

    async function loadTasks() {
      try {
        const data = await api.getTasks()
        if (!cancelled) setTasks(data)
      } catch (err) {
        if (cancelled) return
        api.clearToken()
        setPage('home')
        setError(err instanceof Error ? err.message : 'Could not load tasks.')
      }
    }

    loadTasks()
    return () => {
      cancelled = true
    }
  }, [page])

  useEffect(() => {
    if (!activeTask || activeTask.status !== 'Running') return

    const timer = window.setInterval(async () => {
      try {
        const updated = await api.getTask(activeTask.id)
        setActiveTask(updated)
        setTasks((current) =>
          current.map((task) => task.id === updated.id ? updated : task),
        )
      } catch {
        // Keep the current task visible if a refresh temporarily fails.
      }
    }, 3000)

    return () => window.clearInterval(timer)
  }, [activeTask?.id, activeTask?.status])

  function navigate(destination: Page) {
    setPage(destination)
    setError('')
    setActiveTask(null)
  }

  async function handleAuth(
    mode: 'login' | 'register',
    name: string,
    email: string,
    password: string,
  ) {
    setLoading(true)
    setError('')

    try {
      const response = mode === 'register'
        ? await api.register(name, email, password)
        : await api.login(email, password)

      api.saveToken(response.access_token)
      setUser(response.user)
      setPage('dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  async function startTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = taskInput.trim()
    if (!prompt) return

    setLoading(true)
    setError('')

    try {
      const task = await api.createTask(
        prompt.slice(0, 255),
        prompt,
      )
      setTasks((current) => [task, ...current])
      setActiveTask(task)
      setTaskInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create task.')
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    api.clearToken()
    setUser(null)
    setTasks([])
    setActiveTask(null)
    navigate('home')
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      {page === 'home' && (
        <LandingPage
          onLogin={() => navigate('login')}
          onRegister={() => navigate('register')}
          onDashboard={() => navigate(api.getToken() ? 'dashboard' : 'login')}
        />
      )}

      {(page === 'login' || page === 'register') && (
        <AuthPage
          mode={page}
          loading={loading}
          error={error}
          onSubmit={handleAuth}
          onSwitch={() => navigate(page === 'login' ? 'register' : 'login')}
          onBack={() => navigate('home')}
        />
      )}

      {page === 'dashboard' && (
        <div className="min-h-screen bg-[#f7f8fc]">
          <header className="sticky top-0 z-20 border-b border-base-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
              <button onClick={() => navigate('home')} className="flex items-center gap-2">
                <Logo />
                <span className="text-xl font-bold tracking-tight">QuickTodo</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-slate-500 sm:block">
                  {user?.name || 'My workspace'}
                </span>
                <button onClick={signOut} className="btn btn-outline btn-sm">
                  Sign out
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <div className="mb-10">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
                Your workspace
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                What would you like to get done?
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-500">
                Give QuickTodo a task. Your AI agent will research, analyse and prepare a result.
              </p>
            </div>

            {error && <ErrorMessage message={error} />}

            <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-2xl border border-base-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-xl text-primary">
                    ✦
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Create a task</h2>
                    <p className="text-sm text-slate-500">Describe what you want the agent to do.</p>
                  </div>
                </div>

                <form onSubmit={startTask}>
                  <textarea
                    value={taskInput}
                    onChange={(event) => setTaskInput(event.target.value)}
                    placeholder="Example: Research the top 5 programming languages used in AI and compare their applications..."
                    className="textarea textarea-bordered min-h-36 w-full resize-y bg-white text-base leading-relaxed focus:border-primary"
                  />
                  <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <span className="text-xs text-slate-400">
                      Be specific for more useful results.
                    </span>
                    <button
                      type="submit"
                      disabled={!taskInput.trim() || loading}
                      className="btn btn-primary px-6 text-white"
                    >
                      {loading ? 'Creating...' : 'Start task →'}
                    </button>
                  </div>
                </form>

                <div className="mt-7 border-t border-base-200 pt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Try an example
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Research AI trends in 2026',
                      'Compare Python and Rust',
                      'Find useful web development resources',
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => setTaskInput(example)}
                        className="rounded-full border border-base-300 px-3 py-2 text-xs text-slate-600 transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                      >
                        + {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#172554] p-6 text-white shadow-sm sm:p-8">
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-100">How QuickTodo works</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100">
                    AI workspace
                  </span>
                </div>
                <div className="space-y-6">
                  {[
                    ['01', 'Understand', 'Your task is received and organised.'],
                    ['02', 'Research', 'The agent searches and collects information.'],
                    ['03', 'Analyse', 'AI analyses the collected information.'],
                    ['04', 'Deliver', 'You receive a structured answer with sources.'],
                  ].map(([number, title, description]) => (
                    <div key={number} className="flex gap-4">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/10 text-xs font-bold">
                        {number}
                      </div>
                      <div>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-blue-100/70">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-xl border border-white/10 bg-white/10 p-4">
                  <p className="text-sm font-medium">Designed for real tasks</p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-100/70">
                    Web research, information analysis and source-backed responses in one workspace.
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-12">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-bold">Recent tasks</h2>
                  <p className="mt-1 text-sm text-slate-500">Your recent activity and research.</p>
                </div>
                <span className="text-sm text-slate-400">{tasks.length} tasks</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-base-200 bg-white">
                {tasks.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No tasks yet. Create your first task above.
                  </p>
                ) : (
                  tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setActiveTask(task)}
                      className="flex w-full flex-col gap-3 border-b border-base-200 p-5 text-left transition last:border-0 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          ↗
                        </div>
                        <div>
                          <p className="font-semibold">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(task.created_at)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={task.status} />
                    </button>
                  ))
                )}
              </div>
            </section>
          </main>

          {activeTask && (
            <TaskDetail
              task={activeTask}
              onClose={() => setActiveTask(null)}
              onDelete={async () => {
                try {
                  await api.deleteTask(activeTask.id)
                  setTasks((current) => current.filter((task) => task.id !== activeTask.id))
                  setActiveTask(null)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not delete task.')
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Logo() {
  return (
    <div className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-black text-white">
      Q
    </div>
  )
}

function LandingPage({
  onLogin,
  onRegister,
  onDashboard,
}: {
  onLogin: () => void
  onRegister: () => void
  onDashboard: () => void
}) {
  return (
    <div>
      <header className="border-b border-base-200 bg-white">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#" className="flex items-center gap-2">
            <Logo />
            <span className="text-xl font-bold tracking-tight">QuickTodo</span>
          </a>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-primary">Features</a>
            <a href="#how-it-works" className="hover:text-primary">How it works</a>
            <a href="#technology" className="hover:text-primary">Technology</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onLogin} className="btn btn-ghost btn-sm">Log in</button>
            <button onClick={onRegister} className="btn btn-primary btn-sm text-white">Get started</button>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white">
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 size-96 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 md:grid-cols-2 md:py-28 lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary">
                <span className="size-2 rounded-full bg-primary" />
                Your task execution workspace
              </div>
              <h1 className="max-w-xl text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl">
                Give a task.<span className="block text-primary">Get it done.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-500">
                QuickTodo turns your instructions into research and structured results.
                One workspace for browsing, analysing and getting things done.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button onClick={onRegister} className="btn btn-primary btn-lg text-white">
                  Start using QuickTodo →
                </button>
                <button onClick={onDashboard} className="btn btn-outline btn-lg">
                  Explore workspace
                </button>
              </div>
              <p className="mt-5 text-xs text-slate-400">
                AI-assisted task execution · Web research · Source-backed results
              </p>
            </div>

            <div className="rounded-2xl border border-base-200 bg-white p-5 shadow-2xl shadow-blue-900/10 sm:p-7">
              <div className="mb-5 flex items-center gap-2">
                <Logo />
                <span className="font-bold">QuickTodo workspace</span>
              </div>
              <div className="rounded-xl border border-base-200 bg-base-100 p-4">
                <p className="mb-3 text-xs font-semibold text-slate-400">YOUR TASK</p>
                <p className="text-sm font-medium leading-relaxed">
                  Research the top programming languages used in AI and explain their applications.
                </p>
              </div>
              <div className="my-5 space-y-4">
                {[
                  ['✓', 'Task understood', 'Instructions organised'],
                  ['↗', 'Web research', 'Collecting relevant sources'],
                  ['✦', 'AI analysis', 'Preparing structured findings'],
                ].map(([icon, title, detail], index) => (
                  <div key={title} className="flex items-center gap-3">
                    <div className={`grid size-9 place-items-center rounded-full ${index === 2 ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-600'}`}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-slate-400">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-[#172554] p-4 text-white">
                <p className="text-xs font-semibold text-blue-200">RESULT PREVIEW</p>
                <p className="mt-2 text-sm leading-relaxed">
                  A clear, organised response with findings and links to supporting sources.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#f7f8fc] py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading eyebrow="What you can do" title="More than a simple to-do list" description="QuickTodo is designed to execute tasks, not just store reminders." />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <FeatureCard icon="⌕" title="Web research" description="Search the web and collect useful information for your task." />
              <FeatureCard icon="✦" title="AI-powered analysis" description="Use an AI model to analyse collected information and prepare a structured response." />
              <FeatureCard icon="↗" title="Source-backed results" description="Review the result alongside the source links returned by research." />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading eyebrow="Simple workflow" title="From instruction to result" description="A clear execution flow keeps you informed while your task is being handled." />
            <div className="mt-12 grid gap-8 md:grid-cols-4">
              {[
                ['01', 'Enter a task', 'Describe the outcome you need.'],
                ['02', 'Agent executes', 'The agent researches the task.'],
                ['03', 'AI analyses', 'The model organises the information.'],
                ['04', 'Review results', 'Read the response and explore its sources.'],
              ].map(([number, title, description]) => (
                <div key={number} className="border-l-2 border-primary/20 pl-5">
                  <p className="text-sm font-bold text-primary">{number}</p>
                  <h3 className="mt-3 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="technology" className="bg-[#f7f8fc] py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading eyebrow="Technology" title="Built with a modular architecture" description="Each part has a dedicated responsibility and can evolve independently." />
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {['React', 'TypeScript', 'DaisyUI', 'Python', 'FastAPI', 'SQLite', 'Ollama', 'Qwen3-VL'].map((tech) => (
                <span key={tech} className="rounded-xl border border-base-200 bg-white px-5 py-3 text-sm font-semibold shadow-sm">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-center text-white">
          <div className="mx-auto max-w-3xl px-5">
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to get things done?</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/80">
              Bring your task. QuickTodo provides a workspace to research, analyse and organise the result.
            </p>
            <button onClick={onRegister} className="btn mt-7 border-0 bg-white text-primary hover:bg-blue-50">
              Get started →
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-base-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2"><Logo /><span className="font-bold text-base-content">QuickTodo</span></div>
          <p>Task execution, research and analysis in one workspace.</p>
          <p>© 2026 QuickTodo</p>
        </div>
      </footer>
    </div>
  )
}

function AuthPage({
  mode,
  loading,
  error,
  onSubmit,
  onSwitch,
  onBack,
}: {
  mode: 'login' | 'register'
  loading: boolean
  error: string
  onSubmit: (mode: 'login' | 'register', name: string, email: string, password: string) => Promise<void>
  onSwitch: () => void
  onBack: () => void
}) {
  const isRegister = mode === 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit(mode, name, email, password)
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-[#172554] p-12 text-white lg:flex">
        <button onClick={onBack} className="flex w-fit items-center gap-2">
          <Logo /><span className="text-xl font-bold">QuickTodo</span>
        </button>
        <div className="max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-200">Your task execution workspace</p>
          <h1 className="text-5xl font-black leading-tight">Turn your tasks into results.</h1>
          <p className="mt-6 leading-relaxed text-blue-100/70">
            Research, analyse and organise information through one simple workspace.
          </p>
        </div>
        <p className="text-xs text-blue-200/60">QuickTodo · AI-powered task execution</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <button onClick={onBack} className="mb-10 text-sm text-slate-500 hover:text-primary">← Back to website</button>
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-2"><Logo /><span className="text-xl font-bold">QuickTodo</span></div></div>
          <h2 className="text-3xl font-bold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {isRegister ? 'Get started with your QuickTodo workspace.' : 'Log in to continue to your workspace.'}
          </p>

          {error && <div className="mt-5"><ErrorMessage message={error} /></div>}

          <form className="mt-8 space-y-5" onSubmit={submit}>
            {isRegister && (
              <label className="form-control w-full">
                <span className="label-text mb-2 text-sm font-medium">Full name</span>
                <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} type="text" placeholder="Your name" className="input input-bordered w-full bg-white" />
              </label>
            )}
            <label className="form-control w-full">
              <span className="label-text mb-2 text-sm font-medium">Email address</span>
              <input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" className="input input-bordered w-full bg-white" />
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-2 text-sm font-medium">Password</span>
              <input required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 8 characters" className="input input-bordered w-full bg-white" />
            </label>
            <button disabled={loading} type="submit" className="btn btn-primary w-full text-white">
              {loading ? 'Please wait...' : isRegister ? 'Create account →' : 'Log in →'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={onSwitch} className="font-semibold text-primary hover:underline">
              {isRegister ? 'Log in' : 'Create account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-base-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-2xl text-primary">{icon}</div>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const styles: Record<Task['status'], string> = {
    Completed: 'badge-success',
    Running: 'badge-warning',
    Failed: 'badge-error',
  }

  return (
    <span className={`badge ${styles[status]} badge-outline gap-2`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">
      {message}
    </div>
  )
}

function TaskDetail({
  task,
  onClose,
  onDelete,
}: {
  task: Task
  onClose: () => void
  onDelete: () => Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Task details</p>
            <h2 className="mt-2 text-xl font-bold">{task.title}</h2>
            <p className="mt-2 text-xs text-slate-400">{formatDate(task.created_at)}</p>
          </div>
          <button onClick={onClose} className="btn btn-circle btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>

        <div className="mt-6 rounded-xl bg-base-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Execution status</span>
            <StatusBadge status={task.status} />
          </div>
          <progress className="progress progress-primary mt-4 w-full" value={task.progress} max="100" />
          <p className="mt-1 text-right text-xs text-slate-400">{task.progress}%</p>
        </div>

        {task.status === 'Running' && (
          <p className="mt-5 text-sm text-slate-500">Your task is being processed. This view refreshes automatically.</p>
        )}

        {task.status === 'Failed' && (
          <div className="mt-5 rounded-xl border border-error/30 bg-error/5 p-4">
            <p className="font-semibold text-error">Task failed</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.error_message || 'No error details were returned.'}</p>
          </div>
        )}

        {task.result && (
          <div className="mt-5">
            <h3 className="font-bold">Result</h3>
            <div className="mt-2 whitespace-pre-wrap rounded-xl border border-base-200 bg-white p-4 text-sm leading-relaxed">
              {task.result}
            </div>
          </div>
        )}

        {task.sources && task.sources.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold">Sources</h3>
            <div className="mt-3 space-y-3">
              {task.sources.map((source, index) => (
                <div key={`${source.url}-${index}`} className="rounded-xl border border-base-200 p-4">
                  <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                    {source.title || source.url}
                  </a>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{source.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-2">
          <button onClick={() => void onDelete()} className="btn btn-outline btn-error btn-sm">Delete task</button>
          <button onClick={onClose} className="btn btn-primary btn-sm text-white">Close</button>
        </div>
      </div>
    </div>
  )
}

export default App