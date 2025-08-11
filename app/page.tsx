import TaskDashboard from '@/components/TaskDashboard'
import WeeklyPriorityList from '@/components/WeeklyPriorityList'


export default async function Page() {
  const today = new Date().toISOString().split("T")[0]

  return (
    <main className="mx-auto p-6 space-y-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
      <WeeklyPriorityList />
      <TaskDashboard />
    </main>
  )
}
