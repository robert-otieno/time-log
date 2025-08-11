import TaskList from '@/components/TaskList'
import WeeklyPriorityList from '@/components/WeeklyPriorityList'


export default async function Page() {

  return (
    <main className="mx-auto p-6 space-y-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
      <WeeklyPriorityList />
      <TaskList />
    </main>
  )
}
