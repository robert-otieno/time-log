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