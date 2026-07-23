/**
 * The app's single icon set (glow-up brief §4.2).
 *
 * Every icon is a lucide line icon rendered at one stroke weight (1.75) so
 * iconography reads as one drawn family, matching Inter's optical weight —
 * replacing the previous ad hoc filled Material icons. Screens import from
 * here, never from lucide-react directly, so size/stroke stay uniform and a
 * future set swap is one file.
 *
 * Default size is 20px (nav, buttons, table actions). Pass `size` for the odd
 * outlier; never pass `strokeWidth` — one weight is the whole point.
 */
import { forwardRef } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Contact,
  Download,
  Upload,
  Eye,
  EyeOff,
  Folder,
  HardHat,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';

const DEFAULT_SIZE = 20;
const STROKE_WIDTH = 1.75;

function standardize(LucideIcon, name) {
  const Icon = forwardRef(function Icon({ size = DEFAULT_SIZE, ...props }, ref) {
    return <LucideIcon ref={ref} size={size} strokeWidth={STROKE_WIDTH} aria-hidden {...props} />;
  });
  Icon.displayName = name;
  return Icon;
}

// Navigation
export const DashboardIcon = standardize(LayoutDashboard, 'DashboardIcon');
export const ProjectsIcon = standardize(Folder, 'ProjectsIcon');
export const DeliverablesIcon = standardize(ClipboardList, 'DeliverablesIcon');
export const ResourcesIcon = standardize(HardHat, 'ResourcesIcon');
export const BudgetsIcon = standardize(Landmark, 'BudgetsIcon');
export const ReportsIcon = standardize(BarChart3, 'ReportsIcon');
export const TeamsIcon = standardize(UsersRound, 'TeamsIcon');
export const IndividualsIcon = standardize(Contact, 'IndividualsIcon');
export const InsightsIcon = standardize(TrendingUp, 'InsightsIcon');
export const UsersIcon = standardize(Users, 'UsersIcon');

// Shell
export const MenuIcon = standardize(Menu, 'MenuIcon');
export const SearchIcon = standardize(Search, 'SearchIcon');
export const LogoutIcon = standardize(LogOut, 'LogoutIcon');
export const LightModeIcon = standardize(Sun, 'LightModeIcon');
export const DarkModeIcon = standardize(Moon, 'DarkModeIcon');

// Actions
export const AddIcon = standardize(Plus, 'AddIcon');
export const AddPersonIcon = standardize(UserPlus, 'AddPersonIcon');
export const RemovePersonIcon = standardize(UserMinus, 'RemovePersonIcon');
export const DeleteIcon = standardize(Trash2, 'DeleteIcon');
export const DownloadIcon = standardize(Download, 'DownloadIcon');
export const UploadIcon = standardize(Upload, 'UploadIcon');
export const BackIcon = standardize(ArrowLeft, 'BackIcon');
export const ShowPasswordIcon = standardize(Eye, 'ShowPasswordIcon');
export const HidePasswordIcon = standardize(EyeOff, 'HidePasswordIcon');

// States
export const EmptyInboxIcon = standardize(Inbox, 'EmptyInboxIcon');
