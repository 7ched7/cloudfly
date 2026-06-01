import { FilesAndFoldersReqBody, getFolders, move } from "@/api/api";
import { CustomButton } from "@/components/global/FormElements";
import folderIcon from "@/assets/folder_icon.svg";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import useCustomToast from "@/hooks/useCustomToast";
import { FolderProps } from "@/pages/Drive";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, HardDrive, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";

export default function Move({ id, parent, type, isMoveDialogOpen, setMoveDialogOpen }: { id: string; parent: string; type: string, isMoveDialogOpen: boolean; setMoveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>; }) {
    const [parentFolder, setParentFolder] = useState<string>(parent);
    const [selectedFolderId, setSelectedFolderId] = useState<string>("");

    // toast
    const showToast = useCustomToast();

    // ref
    const cancelBtnRef = useRef<null | HTMLButtonElement>(null);

    // query
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["folders", parentFolder],
        queryFn: () => getFolders(type === "folder" ? id : "", parentFolder || 'root'),
        enabled: isMoveDialogOpen
    });

    const { mutate, isPending } = useMutation({
        mutationFn: (data: { data: FilesAndFoldersReqBody; parent: string; }) => move(data),
        onSuccess: (data) => {
            showToast(data.message);
            queryClient.invalidateQueries({ queryKey: ['drive']});
            queryClient.invalidateQueries({ queryKey: ['quick-access']});
            queryClient.invalidateQueries({ queryKey: ['starred']});
            cancelBtnRef.current?.click();
        },
        onError: (data: any) => {
            showToast(data.response.data.error, false);
        }
    });    

    // handle open folder
    const handleOpenFolder = (id: string) => {
        setParentFolder(id);
    }

    // handle select folder
    const handleSelect = (id: string) => {
        setSelectedFolderId(selectedFolderId === id ? "" : id);
    }

    // handle move
    const handleMove = () => {
        const param = type === "file" ? {files: [{ id }], folders: null} : {files: null, folders: [{ id }]}
        mutate({ data: param, parent: selectedFolderId });
    }

    return (
        <Dialog open={isMoveDialogOpen} onOpenChange={setMoveDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="capitalize">Move {type}</DialogTitle>
                    <DialogDescription>
                        Select a folder to move the {type}
                    </DialogDescription>
                </DialogHeader>

                <div className="h-72 w-full p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-y-auto">
                    {
                        isLoading ? 
                        <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="animate-spin" />
                        </div>
                        :
                        <>
                            <div className="mb-2">
                            {
                                data?.parentFolder ? 
                                <>
                                    <div className="flex items-center text-xs rounded-md">
                                        <CustomButton onClick={() => setParentFolder(data.parentFolder.parent)} className="bg-transparent hover:bg-transparent p-0 h-8 w-8" type="button" variant="ghost" effect={false}>
                                            <ChevronLeft className="scale-75" />
                                        </CustomButton>
                                        <p className="text-xs select-none">{data.parentFolder.name}</p>
                                    </div>
                                    <Separator className="mb-2" />
                                </>
                                :
                                <div onClick={() => handleSelect('root')} className={`flex items-center gap-2 text-xs rounded-md p-2 
                                ${selectedFolderId === "root" ? "bg-bluedefault/25" : "dark:bg-white/5 dark:hover:bg-white/10 bg-blackdefault/5 hover:bg-blackdefault/10"}`}>
                                    <HardDrive className="scale-75" />
                                    <p className="text-xs select-none">My Drive (root)</p>
                                </div>
                            }
                            </div>

                            <>
                            {   
                                data?.folders === null ?
                                <p className="text-center text-xs text-zinc-500 mt-8 select-none">
                                    No folder found in this directory
                                </p>
                                :
                                <div className="grid grid-cols-2 gap-2">
                                    {
                                        data?.folders?.map((folder: FolderProps) => (
                                            <div key={folder.id} onClick={() => handleSelect(folder.id)} onDoubleClick={() => handleOpenFolder(folder.id)} 
                                            className={`flex items-center justify-between text-xs rounded-md 
                                            ${selectedFolderId === folder.id ? "bg-bluedefault/25" : "dark:bg-white/5 dark:hover:bg-white/10 bg-blackdefault/5 hover:bg-blackdefault/10"}`}>
                                                <div className="flex items-center">
                                                    <img src={folderIcon} className="p-2 w-10 select-none pointer-events-none" />
                                                    <p className="select-none">{folder.name}</p>
                                                </div>
                                                <CustomButton onClick={() => handleOpenFolder(folder.id)} className="bg-transparent hover:bg-transparent p-0 h-8 w-8" type="button" variant="secondary" effect={false}>
                                                    <ChevronRight className="scale-75" />
                                                </CustomButton>
                                            </div>
                                        ))
                                    }
                                </div>
                            }
                            </>
                        </>
                        
                    }
                </div>

                <DialogFooter className="sm:justify-start gap-2">
                    <CustomButton
                        onClick={handleMove}
                        disabled={!selectedFolderId ? true : isPending ? true : false}
                        loading={isPending}
                    >
                        Move
                    </CustomButton>
                    <DialogClose asChild>
                        <CustomButton
                            type="button"
                            variant="secondary"
                            ref={cancelBtnRef}
                        >
                            Cancel
                        </CustomButton>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
