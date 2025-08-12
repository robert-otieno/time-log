"use client";

import { getPastWeekDates } from "@/lib/date-utils";
import { SidebarDateProps } from "../lib/sidebar-date-props";

export default function PastDaysSidebar({ selectedDate, onSelectDate }: SidebarDateProps) {
	const days = getPastWeekDates();

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