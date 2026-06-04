import Animate from '@/components/global/Animate'
import stars from "@/assets/stars.svg";
import { useState } from 'react';
import { Title } from '@/components/global/Titles'
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getFilesAndFolders, getStarredFilesAndFolders } from '@/api/api';
import { FolderProps, SelectedItemsProps } from './Drive';
import { CustomButton } from '@/components/global/FormElements';
import FilesAndFolders from '@/components/drive/FilesAndFolders';
import SelectionBar from '@/components/drive/selection-bar/SelectionBar';
import { DrivePageLoading } from '@/components/global/Loading';
import SelectionRectangle from '@/components/global/SelectionRectangle';

export default function Starred() {
    const [parent, setParent] = useState<string>("root");
    const [folderStack, setFolderStack] = useState<{id: string, name: string}[]>([{ id: parent, name: "Starred"}]);
    const [selectedItems, setSelectedItems] = useState<SelectedItemsProps>({ files: [], folders: [], count: 0 });
    const [isSelecting, setIsSelecting] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["starred", parent],
        queryFn: () => parent === "root" ? getStarredFilesAndFolders() : getFilesAndFolders(parent),
        staleTime: 2 * 60 * 1000,
    });

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

    return (
        <>
        <Animate className="min-h-full p-6 lg:p-12">

            {/* title & button */}  
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex items-center justify-start gap-2">
                    {
                        folderStack[folderStack.length - 1].name !== "Starred" && 
                        <CustomButton onClick={handleGoBack} type="button" variant="ghost" effect={false} className="rounded-full p-0 h-8 w-8" >
                            <ChevronLeft />
                        </CustomButton>
                    }
                    <Title>{folderStack[folderStack.length - 1].name}</Title>
                </div>
            </div>
            
            {/* not found */}
            {
                isLoading ? <DrivePageLoading /> : 
                !data.files && !data.folders ? 
                <div className="flex flex-col text-center items-center justify-center gap-4 mt-44 select-none pointer-events-none">
                    <img src={stars} alt="Stars" className="w-48 lg:w-72"/>
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm">
                        No files or folders found. 
                        <br /> 
                        <span className="font-semibold">You can star a file or folder to easily access it later</span>
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

        {/* selection bar */}
        <SelectionBar data={data} setSelectedItems={setSelectedItems} selectedItems={selectedItems} page="starred" />

        {/* selection rectangle */}
        <SelectionRectangle data={data} setSelectedItems={setSelectedItems} setIsSelecting={setIsSelecting} />

        </>
    )
}
