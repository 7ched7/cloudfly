import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customAxios from "@/config/axios";
import { CustomButton } from "../global/FormElements";
import { useUploadContext } from "@/context/UploadContext";
import { v4 as uuid } from 'uuid';
import { useAppDispatch } from "@/store/hooks";
import { setCurrentStorage } from "@/store/user/userSlice";
import { Upload } from "lucide-react";

export default function UploadFile({ parent, fileNames, isLoading, droppedFiles }: { parent: string, fileNames: string[], isLoading: boolean, droppedFiles: FileList | null }) {
    const [sameFiles, setSameFiles] = useState<string[]>([]);
    const [filesFormData, setFilesFormData] =  useState<File[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);

    // context
    const { updateUploadedFiles, updateUploadedFilesProgress, updateUploadStatus } = useUploadContext();

    // redux
    const dispatch = useAppDispatch();

    // ref
    const fileRef = useRef<null | HTMLInputElement>(null);
    const cancelBtnRef = useRef<null | HTMLButtonElement>(null);

    // query
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: async (files: File[]) => {
            const id = uuid();
            
            try {
                const { data } = await customAxios.post("/api/drive/presigned-urls", {
                    files: files.map(f => ({ name: f.name, type: f.type, size: f.size })),
                    parent: parent,
                });
                
                const { accepted } = data;
                
                for (const f of files) {
                    const match = accepted.find((item: { name: string; }) => item.name === f.name);
                    if (!match) continue;
    
                    // add files to uploaded files array to show upload progress component
                    updateUploadedFiles({ id, files, progress: 0 });

                    await customAxios.put(match.url, f, {
                        headers: { "Content-Type": f.type },
                        onUploadProgress(progressEvent) {
                            const { loaded, total } = progressEvent;
                            if (total) {
                                const progress = ((loaded / total) * 100).toFixed(0);
                                // update uploaded file progress bar
                                updateUploadedFilesProgress(id, parseInt(progress));
                            }
                        },
                    });
                }
                
                if (accepted.length > 0) {
                    const { data } = await customAxios.put("/api/drive/complete-upload", {
                        data: accepted.map((f: { fileId: any; version: any; }) => ({ fileId: f.fileId, version: f.version })),
                        parent: parent,
                    });

                    updateUploadStatus(id, true, data.message);       
                    return data;
                }
            } catch (error: any) {
                updateUploadStatus(id, false, error.response.data.error);
            }
                 
        },
        onSuccess: (data) => {
            dispatch(setCurrentStorage(data.currentStorage))
            queryClient.invalidateQueries({ queryKey: ["drive", parent]});
            queryClient.invalidateQueries({ queryKey: ['quick-access']});
            queryClient.invalidateQueries({ queryKey: ['starred']});
        }
    });

    // handle upload
    const handleUpload = (files: File[]) => {
        mutate(files);
        cancelBtnRef.current?.click();
    };
    
    // handle file input change
    const handleChange = (e?: React.ChangeEvent<HTMLInputElement>) => {
        e?.preventDefault();

        const files = Array.from(e?.target.files as FileList || droppedFiles)    

        let filesWithConflicts: string[] = [];
        
        for (const file of files) {
            if (fileNames.includes(file.name)) {
                filesWithConflicts.push(file.name);
            }
        }
        
        // if there is a conflict show dialog otherwise upload files immediately
        if (filesWithConflicts.length > 0) {
            setDialogOpen(true);
            setSameFiles(filesWithConflicts);
            setFilesFormData(files);
        } else {
            handleUpload(files);
        } 
    };

    useEffect(() => {
        if (droppedFiles && fileRef.current) {
            fileRef.current.value = "";
            handleChange();
        }
    }, [droppedFiles])

    return (
        <>
            <input
                type="file"
                name="files"
                id="files"
                accept="*"
                multiple
                hidden
                ref={fileRef}
                onChange={handleChange}
            />
            <CustomButton
                type="button"
                className="bg-bluedefault hover:bg-bluedefault/95 text-white cursor-default rounded-full"
                disabled={isLoading}
                variant="default"
                onClick={() => {
                    if (fileRef.current) {
                        fileRef.current.click();
                        fileRef.current.value = "";
                    }
                }}
            >
                <Upload />
                Upload File
            </CustomButton>

            
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {sameFiles?.length > 1 ? 
                            "Files already exist" : 
                            "File already exists"}
                        </DialogTitle>
                        <DialogDescription className="flex flex-col gap-y-4">
                            {sameFiles?.length > 1 ? 
                            "The files you are trying to upload already exist in this directory" : 
                            "The file you are trying to upload already exists in this directory"}
                        </DialogDescription>
                        <div className="grid grid-cols-3 gap-4 text-xs max-h-48 overflow-y-auto py-2">
                            {sameFiles?.map((name) => (
                                <div key={name} className="dark:bg-zinc-800 bg-zinc-100 p-2 flex items-center gap-2 rounded-md">
                                    {`${name}`.length > 15
                                        ? `${name}`.substring(0,12) + "..."
                                        : `${name}`}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-red-500 border-t pt-2">
                            {sameFiles?.length > 1 ? 
                                "Uploading will automatically create a new version for these files. Older versions will be preserved." : 
                                "Uploading will automatically create a new version for this file. The older version will be preserved."}
                        </p>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-start gap-2">
                        <CustomButton onClick={() => handleUpload(filesFormData)} type="button" >Keep Both</CustomButton>
                        <DialogClose asChild>
                            <CustomButton type="button" variant="secondary" ref={cancelBtnRef}>
                                Cancel
                            </CustomButton>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
