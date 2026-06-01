import Animate from "@/components/global/Animate";
import goingUp from "@/assets/going_up.svg";
import { Title } from "@/components/global/Titles";
import { getFilesAndFolders } from "@/api/api";
import { useQuery } from "@tanstack/react-query";
import { DragEvent, useEffect, useState } from "react";
import CreateFolder from "@/components/drive/CreateFolder";
import { ChevronLeft, HardDriveUpload } from "lucide-react";
import UploadFile from "@/components/drive/UploadFile";
import { CustomButton } from "@/components/global/FormElements";
import FilesAndFolders from "@/components/drive/FilesAndFolders";
import SelectionBar from "@/components/drive/selection-bar/SelectionBar";
import { DrivePageLoading } from "@/components/global/Loading";
import SelectionRectangle from "@/components/global/SelectionRectangle";

export interface FileProps {
    id: string; 
    parent: string; 
    originalName: string; 
    mimeType: string;
    type: string; 
    isStarred: boolean;
    isDeleted: boolean;
    publicKey: string | null;
}

export interface FolderProps {
    id: string; 
    parent: string; 
    name: string; 
    isStarred: boolean;
    isDeleted: boolean;
}

export interface SelectedItemsProps {
    files: FileProps[];
    folders: FolderProps[];
    count: number;
}

export default function Drive() {
    const [parent, setParent] = useState<string>("root");
    const [fileNames, setFileNames] = useState<string[]>([]);
    const [folderStack, setFolderStack] = useState<{id: string, name: string}[]>([{ id: parent, name: "My Drive"}]);
    const [selectedItems, setSelectedItems] = useState<SelectedItemsProps>({ files: [], folders: [], count: 0 });
    const [isSelecting, setIsSelecting] = useState(false);
    const [droppedFiles, setDroppedFiles] = useState<FileList | null>(null);
    const [dragging, setDragging] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["drive", parent],
        queryFn: () => getFilesAndFolders(parent),
        staleTime: 2 * 60 * 1000,
    });

    useEffect(() => {
        setFileNames([]);
        if (data && data.files !== null) {
            const newFileNames = data.files.map((file: FileProps) => file.originalName);
            setFileNames(newFileNames);
        }
    }, [data]);

    // handle change directory 
    const handleChangeDirectory = (folder: FolderProps) => {
        setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
        setParent(folder.id);
        setSelectedItems({ files: [], folders: [], count: 0 });
    }

    // handle go back
    const handleGoBack = () => {
        const currentFolderId = folderStack[folderStack.length - 1].id;
        const prevFolderId = folderStack[folderStack.length - 2].id || 'root';
        setFolderStack((stack) => stack.filter((s) => s.id !== currentFolderId));
        setParent(prevFolderId);
    }

    // handle drop files
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDroppedFiles(null);
        setDragging(false);
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            setDroppedFiles(droppedFiles);
        }
    };

    return (
        <>
        {/* drag and drop */}
        <Animate className={`min-h-full p-6 lg:p-12 ${dragging && "transition-colors bg-bluedefault/10 outline-double outline-1 -outline-offset-4 outline-bluedefault rounded-md"}`}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={(e) => {
                const relatedTarget = e.relatedTarget as Node | null;
                if (e.relatedTarget && e.currentTarget.contains(relatedTarget)) return;
                setDragging(false);
            }}
            onDragExit={() => setDragging(false)}
            onDrop={handleDrop}
        > 

            {/* title & buttons*/}  
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex items-center justify-start gap-2">
                    {
                        folderStack[folderStack.length - 1].name !== "My Drive" && 
                        <CustomButton onClick={handleGoBack} type="button" variant="ghost" effect={false} className="rounded-full p-0 h-8 w-8" >
                            <ChevronLeft />
                        </CustomButton>
                    }
                    <Title>{folderStack[folderStack.length - 1].name}</Title>
                </div>
                <div className="flex gap-2">
                    <UploadFile  parent={parent} fileNames={fileNames} isLoading={isLoading} droppedFiles={droppedFiles} />
                    <CreateFolder parent={parent} isLoading={isLoading} />
                </div>
            </div>
            
            {/* not found */}
            {
                isLoading ? <DrivePageLoading /> : 
                !data.files && !data.folders ? 
                <div className="flex flex-col text-center items-center justify-center gap-4 mt-36 select-none pointer-events-none">
                    <img src={goingUp} alt="Upload file" className="w-48 lg:w-72"/>
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm">
                        It looks like the space is empty. 
                        <br /> 
                        <span className="font-semibold">Please upload a file or create a folder to add content</span>
                    </p>
                </div> :
                // files and folders
                <FilesAndFolders 
                    data={data}
                    handleChangeDirectory={handleChangeDirectory}
                    setSelectedItems={setSelectedItems}
                    selectedItems={selectedItems}
                    isSelecting={isSelecting}
                />
            }
            
        </Animate>

        <div
            className={`transition-all shadow-md flex items-center justify-center gap-2 p-4 text-sm text-white bg-bluedefault rounded-full fixed bottom-0 left-1/2 transform -translate-x-1/2 z-10 
            ${dragging ? `visible opacity-1 -translate-y-32` : `invisible opacity-0`} `}>
                <HardDriveUpload className="scale-75" /> Drop files to upload
        </div>

        {/* selection bar */}
        <SelectionBar data={data} setSelectedItems={setSelectedItems} selectedItems={selectedItems} page="drive" />

        {/* selection rectangle */}
        <SelectionRectangle data={data} setSelectedItems={setSelectedItems} setIsSelecting={setIsSelecting} />

        </>
    )
}
