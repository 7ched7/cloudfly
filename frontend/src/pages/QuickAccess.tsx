import Animate from "@/components/global/Animate";
import { getFilesAndFolders, getLatestFiles, searchFilesAndFolders } from "@/api/api";
import { CustomButton, InputField } from "@/components/global/FormElements";
import { Subtitle, Title } from "@/components/global/Titles";
import { useQuery } from "@tanstack/react-query";
import upload_files from "@/assets/upload_files.svg";
import { ChevronLeft, Search, SearchX } from "lucide-react";
import { DrivePageLoading, QuickAccessPageLoading } from "@/components/global/Loading";
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import FilesAndFolders from "@/components/drive/FilesAndFolders";
import File from "@/components/drive/File";
import { FileProps, FolderProps, SelectedItemsProps } from "./Drive";
import SelectionBar from "@/components/drive/selection-bar/SelectionBar";
import SelectionRectangle from "@/components/global/SelectionRectangle";

export default function QuickAccess() {
    const [parent, setParent] = useState<string>("root");
    const [folderStack, setFolderStack] = useState<{id: string, name: string}[]>([{ id: parent, name: "Quick Access"}]);
    const [selectedItems, setSelectedItems] = useState<SelectedItemsProps>({ files: [], folders: [], count: 0 });
    const [isSelecting, setIsSelecting] = useState(false);
    const [query, setQuery] = useState("");

    const debounceQuery = useDebounce(query, 1000);

    // get latest files
    const { data, isLoading } = useQuery({
        queryKey: ["quick-access"],
        queryFn: () => getLatestFiles(),
    });

    // search 
    const { data: searchData, isLoading: searchLoading } = useQuery({
        queryKey: ["search", debounceQuery],
        queryFn: () => searchFilesAndFolders(debounceQuery),
        enabled: !!debounceQuery
    });

    // open folder
    const { data: driveData, isLoading: driveLoading } = useQuery({
        queryKey: ["open-folder", parent],
        queryFn: () => getFilesAndFolders(parent),
        staleTime: 2 * 60 * 1000,
        enabled: parent !== "root"
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

            {/* title & search */}  
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 justify-between">
            <div className="flex items-center justify-start gap-2">
                    {
                        folderStack[folderStack.length - 1].name !== "Quick Access" && 
                        <CustomButton onClick={handleGoBack} type="button" variant="ghost" effect={false} className="rounded-full p-0 h-8 w-8" >
                            <ChevronLeft />
                        </CustomButton>
                    }
                    <Title className="whitespace-nowrap">{folderStack[folderStack.length - 1].name}</Title>
                </div>
                {
                    !data?.lastUploadedFiles && !data?.lastUpdatedFiles ? <></> :
                    <div className={`relative w-full ${parent !== "root" && "hidden"}`}>
                        <InputField className="rounded-full pl-12" type="text" placeholder="Search files and folders" onChange={(e) => setQuery(e.target.value)} />
                        <Search className="scale-75 absolute top-2 left-4" />
                    </div>
                }
            </div>
            
            {
                !debounceQuery ? 
                isLoading ? <QuickAccessPageLoading /> : 
                !data.lastUploadedFiles && !data.lastUpdatedFiles ? 
                <div className="flex flex-col text-center items-center justify-center gap-4 mt-40 select-none pointer-events-none">
                    <img src={upload_files} alt="Upload files" className="w-48 lg:w-72"/>
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm">
                        It looks like you haven’t uploaded or interacted with any files yet. 
                        <br /> 
                        <span className="font-semibold">Once you start adding files, they will appear here</span>
                    </p>
                </div> :
                <>
                {/* last uploaded files */}
                {
                    data?.lastUploadedFiles && <>
                        <Subtitle className="mt-12 text-xs text-zinc-800 dark:text-zinc-200">Last uploaded files</Subtitle>
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8 gap-4 text-xs">
                            {
                                data.lastUploadedFiles.map((file: FileProps) => (
                                    <File 
                                        key={file.id} 
                                        file={file}
                                    />
                                ))
                            }
                        </div>
                    </>
                }

                {/* last updated files */}
                {
                    data?.lastUpdatedFiles && <>
                        <Subtitle className="mt-12 text-xs text-zinc-800 dark:text-zinc-200">Last updated files</Subtitle>
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8 gap-4 text-xs">
                            {
                                data.lastUpdatedFiles.map((file: FileProps) => (
                                    <File 
                                        key={file.id} 
                                        file={file}
                                    />
                                ))
                            }
                        </div>
                    </>
                }
                </>
                :
                searchLoading ? <DrivePageLoading /> : 
                !searchData?.files && !searchData?.folders ? 
                <div className="flex flex-col text-center items-center justify-center gap-4 mt-44 select-none pointer-events-none">
                    <SearchX width={200} height={200} />
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm">
                        Sorry, we couldn't find any files or folders matching
                        {" "} 
                        <span className="font-semibold">'{debounceQuery}'</span>
                    </p>
                </div> :
                <FilesAndFolders 
                    data={driveData ? driveData : searchData}
                    handleChangeDirectory={handleChangeDirectory}
                    setSelectedItems={setSelectedItems}
                    selectedItems={selectedItems}
                    isSelecting={isSelecting}
                />
            }

        </Animate>

        <SelectionBar data={driveData ? driveData : searchData} setSelectedItems={setSelectedItems} selectedItems={selectedItems} page="quick-access" />

        {/* selection rectangle */}
        <SelectionRectangle data={driveData ? driveData : searchData} setSelectedItems={setSelectedItems} setIsSelecting={setIsSelecting} />

        </>
  )
}
