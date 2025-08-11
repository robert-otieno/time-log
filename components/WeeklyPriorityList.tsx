"use client";

import { useState, useEffect } from "react";
import { getWeeklyPriorities, addWeeklyPriority, deleteWeeklyPriority } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Delete, GripVertical, MoreVertical, Plus } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export default function WeeklyPriorityList() {
	const now = new Date();
	const dayOfWeek = now.getDay();
	const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
	const monday = new Date(now.setDate(diff));
	const weekStart = monday.toISOString().slice(0, 10);
	const [priorities, setPriorities] = useState<any[]>([]);
	const [newPriority, setNewPriority] = useState("");
	const [filter, setFilter] = useState<"all" | "work" | "personal">("all");


	useEffect(() => {
		loadPriorities();
	}, []);

	async function loadPriorities() {
		const res = await getWeeklyPriorities(weekStart);
		setPriorities(res);
	}

	async function handleAddPriority() {
		if (!newPriority.trim()) return;
		await addWeeklyPriority(newPriority, weekStart);
		setNewPriority("");
		await loadPriorities();
	}

	async function handleDeletePriority(id: number) {
		await deleteWeeklyPriority(id);
		await loadPriorities();
	}

	return (
		// <div className="p-4 space-y-4">
		//   <h2 className="text-xl font-bold">Weekly Priorities</h2>
		//   <div className="flex gap-2">
		//     <Input
		//       placeholder="New priority..."
		//       value={newPriority}
		//       onChange={(e) => setNewPriority(e.target.value)}
		//     />
		//     <Button size="icon" onClick={handleAddPriority}> <Plus /></Button>
		//   </div>
		//   <ul className="space-y-2">
		//     {priorities.map((priority) => (
		//       <li key={priority.id} className="flex text-xs items-center gap-2 border-b">
		//         <span>{priority.title}</span>
		//         <Button
		//           variant="destructive"
		//           size="icon"
		//           className="ml-auto size-8"
		//           onClick={() => handleDeletePriority(priority.id)}

		//         >
		//           <Delete />
		//         </Button>
		//       </li>
		//     ))}
		//   </ul>
		// </div>
		<Card className="border-0 shadow-sm">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-2xl">Weekly Priorities</CardTitle>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="gap-2">
								{filter === "all" ? "All" : filter === "work" ? "Work" : "Personal"}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-40">
							<DropdownMenuItem onClick={() => setFilter("all")}>All</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("work")}>Work</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setFilter("personal")}>Personal</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="mt-3 flex gap-2">
					<Input
						placeholder="New priority… e.g., ‘Submit thesis draft’"
						value={newPriority}
						onChange={(e) => setNewPriority(e.target.value)}
					/>
					<Button size="icon" onClick={handleAddPriority} aria-label="Add priority">
						<Plus />
					</Button>
				</div>
			</CardHeader>

			<CardContent className="pt-2">
				<ul className="divide-y">
					{priorities.length === 0 && (
						<li className="py-6 text-sm text-muted-foreground">
							No priorities yet. Try “Wedding planning,” “Identify photography venue,” or “Chapter 1–2 thesis.”
						</li>
					)}

					{priorities.map((p) => (
						<li key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
							{/* Tag/Initials circle placeholder */}
							<div className="h-8 w-8 shrink-0 rounded-full bg-muted/70 grid place-items-center text-[10px] font-semibold uppercase">
								{p.tag ?? "st"}
							</div>

							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<span className="truncate font-medium">{p.title}</span>
								</div>
								<div className="mt-2 flex items-center gap-3">
									<Progress value={p.progress ?? 0} className="h-2 w-56 max-w-full" />
									<span className="text-xs text-muted-foreground">{(p.progress ?? 0).toFixed(0)}%</span>
								</div>
							</div>

							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" title="Drag to sort">
									<GripVertical className="h-4 w-4" />
								</Button>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Priority actions">
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-44">
										<DropdownMenuItem disabled>Rename (coming soon)</DropdownMenuItem>
										<DropdownMenuItem disabled>Add subtask (coming soon)</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleDeletePriority(p.id)} className="text-destructive">
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</li>
					))}
				</ul>

				{/* Subtle helper */}
				<div className="mt-3">
					<Badge variant="secondary" className="text-xs">
						Tip: Use the menu to manage priorities. Drag handle to reorder.
					</Badge>
				</div>
			</CardContent>
		</Card>
	);
}
