import { FileProps, FolderProps } from "@/pages/Drive";
import { getColor } from "@/utils/color";
import FileActionsMenu from "./actions-menu/FileActionsMenu";
import { StarIcon } from "lucide-react";

export default function File({ 
    file, 
    handleSelectItem, 
    isSelected 
    }: 
    { 
    file: FileProps; 
    handleSelectItem?: (item: FileProps | FolderProps, type: 'file' | 'folder') => void; 
    isSelected?: boolean;
}) {
    return (
        <div className={`item file w-full h-48 flex flex-col items-start border rounded-md group overflow-hidden relative 
            ${isSelected ? "bg-bluedefault/20 hover:bg-bluedefault/25" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
            id={file.id}
            >

            <div onClick={() => handleSelectItem && handleSelectItem(file, "file")} className="w-full h-full p-2">
                <div className={`flex items-center justify-center h-32 ${getColor(file.mimeType)} font-semibold text-xl text-white uppercase rounded-md mb-2 select-none pointer-events-none`}>
                    {file.type}
                </div>
                <p className="font-medium select-none">{file.originalName}</p>
                <p className="text-zinc-500 select-none">{file.type}</p>
            </div>

            {/* star icon */}
            {
                file.isStarred &&
                <StarIcon className="scale-50 absolute top-4 left-4 text-transparent fill-white invisible group-hover:visible" />
            }
           
            {/* overflow menu */}
            <FileActionsMenu {...file} />

        </div>
    );
}
