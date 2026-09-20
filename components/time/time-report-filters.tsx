"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimeReportFilters } from "@/domain/time/reporting";

type Option = { id: string; name?: string; title?: string };

export function TimeReportFilters({
  filters,
  users = [],
  tasks = [],
  showUser = false,
  showTask = true,
  clientSafe = false,
}: {
  filters: TimeReportFilters;
  users?: Option[];
  tasks?: Option[];
  showUser?: boolean;
  showTask?: boolean;
  clientSafe?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(filters);
  const apply = () =>
    startTransition(() => {
      const query = new URLSearchParams({
        startDate: values.startDate,
        endDate: values.endDate,
        billable: values.billable,
        reportingStatus: clientSafe ? "approved" : values.reportingStatus,
      });
      if (values.userId) query.set("userId", values.userId);
      if (values.taskId) query.set("taskId", values.taskId);
      router.push(`${pathname}?${query}`);
    });
  return (
    <div
      className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-6"
      aria-busy={pending}
    >
      <div className="space-y-2">
        <Label htmlFor="report-start">From</Label>
        <Input
          id="report-start"
          type="date"
          value={values.startDate}
          onChange={(event) =>
            setValues({ ...values, startDate: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-end">Through</Label>
        <Input
          id="report-end"
          type="date"
          value={values.endDate}
          onChange={(event) =>
            setValues({ ...values, endDate: event.target.value })
          }
        />
      </div>
      {showUser && (
        <div className="space-y-2">
          <Label>User</Label>
          <Select
            value={values.userId ?? "all"}
            onValueChange={(value) =>
              setValues({
                ...values,
                userId: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showTask && (
        <div className="space-y-2">
          <Label>Task</Label>
          <Select
            value={values.taskId ?? "all"}
            onValueChange={(value) =>
              setValues({
                ...values,
                taskId: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              {tasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Billable</Label>
        <Select
          value={values.billable}
          onValueChange={(value: "all" | "yes" | "no") =>
            setValues({ ...values, billable: value })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Billable</SelectItem>
            <SelectItem value="no">Non-billable</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!clientSafe && (
        <div className="space-y-2">
          <Label>Client reporting</Label>
          <Select
            value={values.reportingStatus}
            onValueChange={(value: "all" | "internal" | "approved") =>
              setValues({ ...values, reportingStatus: value })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-end">
        <Button
          className="w-full"
          disabled={
            pending ||
            !values.startDate ||
            !values.endDate ||
            values.endDate < values.startDate
          }
          onClick={apply}
        >
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Applying…" : "Apply filters"}
        </Button>
      </div>
    </div>
  );
}
