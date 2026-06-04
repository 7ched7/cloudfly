import folderIcon from "@/assets/folder_icon.svg";
import { FileProps, FolderProps } from "@/pages/Drive";
import FolderActionsMenu from "./actions-menu/FolderActionsMenu";
import { StarIcon } from "lucide-react";

export default function Folder({ 
    folder, 
    handleChangeDirectory, 
    handleSelectItem,
    isSelected 
    }: 
    { 
    folder: FolderProps; 
    handleChangeDirectory?: (folder: FolderProps) => void; 
    handleSelectItem: (item: FileProps | FolderProps, type: 'file' | 'folder') => void; 
    isSelected: boolean; 
}) {
    return (
        <div className={`item folder flex justify-between items-center rounded-full group relative
            ${isSelected ? "bg-bluedefault/20 hover:bg-bluedefault/25" : "dark:bg-zinc-900 dark:hover:bg-zinc-800 bg-zinc-100 hover:bg-zinc-200"}`}
            id={folder.id}
            >

            <div className="w-full h-full flex items-center overflow-hidden px-2" onDoubleClick={() => { if (handleChangeDirectory) handleChangeDirectory(folder) }} onClick={() => handleSelectItem(folder, "folder")}>
                <img src={folderIcon} className="p-2 w-10 select-none pointer-events-none" />
                <p className="font-medium select-none">{folder.name}</p>
            </div>

            {/* star icon */}
            {
                folder.isStarred &&
                <StarIcon className="scale-50 absolute top-2 right-8 text-transparent fill-blackdefault dark:fill-white invisible group-hover:visible" />
            }

            {/* overflow menu */}
            <FolderActionsMenu {...folder} />
            
        </div>
    );
}
