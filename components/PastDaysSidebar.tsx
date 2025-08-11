// "use client";

// import { useState, useEffect } from "react";
// import { getTaskDates } from "@/app/actions";
// import { Button } from "@/components/ui/button";

// interface PastDaysSidebarProps {
// 	onSelect: (date: string) => void;
// }

// export default function PastDaysSidebar({ onSelect }: PastDaysSidebarProps) {
// 	const [dates, setDates] = useState<string[]>([]);

// 	useEffect(() => {
// 		async function load() {
// 			const res = await getTaskDates();
// 			setDates(res);
// 		}
// 		load();
// 	}, []);

// 	return (
// 		<aside className="w-full border-r bg-sidebar text-sidebar-foreground p-4">
// 			<ul className="flex flex-col gap-1">
// 				{dates.map((date) => (
// 					<li key={date}>
// 						<Button
// 							variant="ghost"
// 							className="w-full justify-start"
// 							onClick={() => onSelect(date)}
// 						>
// 							{date}
// 						</Button>
// 					</li>
// 				))}
// 			</ul>
// 		</aside>
// 	);
// }

"use client";

interface PastDaysSidebarProps {
	selectedDate: string;
	onSelectDate: (date: string) => void;
}

export default function PastDaysSidebar({ selectedDate, onSelectDate }: PastDaysSidebarProps) {
	const days = Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() - i);
		return d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
	});

	return (
		<aside className="w-48 border-r pr-2">
			<ul>
				{days.map((day) => (
					<li key={day}>
						<button
							className={`block w-full text-left px-2 py-1 rounded ${selectedDate === day ? "bg-muted" : ""}`}
							onClick={() => onSelectDate(day)}
						>
							{day}
						</button>
					</li>
				))}
			</ul>
		</aside>
	);
}