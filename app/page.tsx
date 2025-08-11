import TaskList from '@/components/TaskList'
import { getTodayTasks, getRhythmTasks } from './actions'

export default async function Page() {
  const today = new Date().toISOString().split('T')[0]
  const daily = await getTodayTasks(today)
  const rhythm = await getRhythmTasks()

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <section>
        <h2 className="text-xl font-semibold">
          Today — {new Date().toLocaleDateString()}
        </h2>
        <TaskList initialTasks={daily} type="daily" />
      </section>

      <section>
        <h2 className="text-xl font-semibold">Rhythm Tasks</h2>
        <TaskList initialTasks={rhythm} type="rhythm" />
      </section>
    </main>
  )
}
