import { deletePermanently, FilesAndFoldersReqBody } from "@/api/api";
import { CustomButton } from "@/components/global/FormElements";
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
import { useAppDispatch } from "@/store/hooks";
import { setCurrentStorage } from "@/store/user/userSlice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

export default function Delete({ id, type, isDeleteDialogOpen, setDeleteDialogOpen }: { id: string; type: string; isDeleteDialogOpen: boolean; setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>; }) {
    // toast
    const showToast = useCustomToast();

    // redux
    const dispatch = useAppDispatch();

    // ref
    const cancelBtnRef = useRef<null | HTMLButtonElement>(null);

    // query
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: (data: FilesAndFoldersReqBody) => deletePermanently(data),
        onSuccess: (data) => {
            showToast(data.message);
            dispatch(setCurrentStorage(data.currentStorage))
            queryClient.invalidateQueries({ queryKey: ['trash']});
            cancelBtnRef.current?.click();
        },
        onError: (data: any) => {
            showToast(data.response.data.error, false);
        }
    });

    // handle delete
    const handleDelete = () => {
        const param = type === "file" ? {files: [{ id }], folders: null} : {files: null, folders: [{ id }]}
        mutate(param);
    }

    return (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="capitalize">Delete {type}</DialogTitle>
                    <DialogDescription>
                        Once you delete this {type}, it will be permanently removed from the system and cannot be restored under any circumstances. 
                        Please ensure that you have a backup or are absolutely certain before proceeding with the deletion
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-start gap-2">
                    <CustomButton
                        onClick={handleDelete}
                        type="button"
                        variant="destructive"
                        loading={isPending}
                    >
                        Delete Permanently
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
