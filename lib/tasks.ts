// export const tagOptions = ["Work", "Personal", "Study", "Event Planning", "Will", "GBDCEI"];
import type { Category } from "./types/categories";

export const priorityOptions = ["Low", "Medium", "High", "Urgent"];

export const defaultCategories: Category[] = [
  { id: "faith", name: "Faith" },
  { id: "career-professional-development", name: "Career/Professional Development" },
  { id: "personal", name: "Personal" },
  { id: "health-wellness", name: "Health & Wellness" },
  { id: "home-family", name: "Home/Family" },
  { id: "business", name: "Business" },
  { id: "finance", name: "Finance" },
];
