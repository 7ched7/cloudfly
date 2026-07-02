import {
    ChevronRight,
    FileStack,
    FolderHeart,
    HardDrive,
    Settings,
    Trash2,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Progress } from "../ui/progress";
import LogoutButton from "../auth/LogoutButton";
import { bytesToSize, convertToPercentage } from "@/utils/convert";
import { User } from "@/store/user/userSlice";

export default function DesktopSidebar({ user, isSidebarOpen }: { user: User | null; isSidebarOpen: boolean | null; }) {
    return (
        <>
            <div className={`w-full h-full bg-white dark:bg-blackdefault border-r px-6 py-4 flex flex-col justify-between ${!isSidebarOpen && 'hidden'}`}>
                <div>
                    {/* header */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="w-full flex justify-between items-center mb-4 p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800">
                            <div className="w-full flex items-center justify-between">
                                <div className="flex items-center gap-2">

                                    <Avatar className="rounded-md w-8 h-8 select-none">
                                        <AvatarImage
                                            src={user?.profileImage}
                                            alt={user?.firstName}
                                        />
                                        <AvatarFallback className="rounded-md">
                                            {`${user?.firstName}`.slice(0, 1)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="text-start">
                                        <p className="font-semibold text-sm">
                                            {`${user?.firstName} ${user?.lastName}`.length > 15
                                                ? `${user?.firstName} ${user?.lastName}`.substring(0,12) + "..."
                                                : `${user?.firstName} ${user?.lastName}`}
                                        </p>
                                        <p className="text-zinc-500 text-xs">
                                            {`${user?.email}`.length > 15
                                                ? `${user?.email}`.substring(0,20) + "..."
                                                : `${user?.email}`}
                                        </p>
                                    </div>
                                </div>
                                <Settings className="scale-75" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link
                                    to="/profile/settings"
                                    className="flex items-center gap-1"
                                >
                                    Settings
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <LogoutButton />
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* body */}
                    <p className="font-bold text-xs text-muted-foreground p-2">
                        Tabs
                    </p>
                    <ul>
                        <li>
                            <NavLink
                                to="/drive"
                                className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                >
                                <div className="flex items-center gap-2">
                                    <HardDrive className="scale-75" />
                                    <p className="text-sm">My Drive</p>
                                </div>
                                <ChevronRight className="scale-50" />
                            </NavLink>
                        </li>

                        <li>
                            <NavLink
                                to="/quick-access"
                                className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                >
                                <div className="flex items-center gap-2">
                                    <FileStack className="scale-75" />
                                    <p className="text-sm">Quick Access</p>
                                </div>
                                <ChevronRight className="scale-50" />
                            </NavLink>
                        </li>

                        <li>
                            <NavLink
                                to="/starred"
                                className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                >
                                <div className="flex items-center gap-2">
                                    <FolderHeart className="scale-75" />
                                    <p className="text-sm">Starred</p>
                                </div>
                                <ChevronRight className="scale-50" />
                            </NavLink>
                        </li>

                        <li>
                            <NavLink
                                to="/trash"
                                className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                >
                                <div className="flex items-center gap-2">
                                    <Trash2 className="scale-75" />
                                    <p className="text-sm">Trash</p>
                                </div>
                                <ChevronRight className="scale-50" />
                            </NavLink>
                        </li>
                    </ul>
                </div>

                {/* footer */}
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger className="cursor-default">
                        <div className="text-xs border rounded-md select-none flex flex-col justify-center items-center gap-2 p-2 mt-2">
                            {bytesToSize(user?.currentStorage)}
                            {" / "}
                            {bytesToSize(user?.maxStorage)}
                            <Progress value={convertToPercentage(user?.currentStorage, user?.maxStorage)} className="bg-whitedefault h-1" />
                        </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-xs">
                                {bytesToSize((user?.maxStorage || 0) - (user?.currentStorage || 0))}
                                {" "}of free memory out of{" "}
                                {bytesToSize(user?.maxStorage)}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                
            </div>

            {/* small sidebar for desktop */}
            {
                !isSidebarOpen && 
                <div className="hidden lg:flex w-20 h-screendefault p-4 border-r flex-col gap-2 items-center">
                    {/* header */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 rounded-full">
                            <div className="w-full flex items-center justify-between">
                                <Avatar className="rounded-full w-8 h-8 select-none">
                                    <AvatarImage
                                        src={user?.profileImage}
                                        alt={user?.firstName}
                                    />
                                    <AvatarFallback className="rounded-md">
                                        {`${user?.firstName}`.slice(0, 1)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <Link
                                    to="/profile/settings"
                                    className="flex items-center gap-1"
                                >
                                    Settings
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <LogoutButton />
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ul className="flex flex-col gap-2">
                        <li>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <NavLink
                                            to="/drive"
                                            className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                            >
                                            <HardDrive className="scale-75" />
                                        </NavLink>
                                    </TooltipTrigger>
                                    <TooltipContent className="absolute whitespace-nowrap left-6 top-1">
                                    <p>My Drive</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </li>

                        <li>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <NavLink
                                            to="/quick-access"
                                            className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                            >
                                            <FileStack className="scale-75" />
                                        </NavLink>
                                    </TooltipTrigger>
                                    <TooltipContent className="absolute whitespace-nowrap left-6 top-1">
                                    <p>Quick Access</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </li>

                        <li>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <NavLink
                                            to="/starred"
                                            className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                            >
                                            <FolderHeart className="scale-75" />
                                        </NavLink>
                                    </TooltipTrigger>
                                    <TooltipContent className="absolute whitespace-nowrap left-6 top-1">
                                    <p>Starred</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </li>

                        <li>
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <NavLink
                                            to="/trash"
                                            className="flex justify-between p-2 rounded-full cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                            >
                                            <Trash2 className="scale-75" />
                                        </NavLink>
                                    </TooltipTrigger>
                                    <TooltipContent className="absolute whitespace-nowrap left-6 top-1">
                                    <p>Trash</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </li>
                    </ul>
                </div>
            }
        </>
  )
}
