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
    DialogTrigger,
} from "@/components/ui/dialog";
import useCustomToast from "@/hooks/useCustomToast";
import { SelectedItemsProps } from "@/pages/Drive";
import { useAppDispatch } from "@/store/hooks";
import { setCurrentStorage } from "@/store/user/userSlice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRef } from "react";

export default function Delete({ items }: { items: SelectedItemsProps }) {
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
        const fileIdArr = items.files.map((item) => ({ id: item.id })); 
        const folderIdArr = items.folders.map((item) => ({ id: item.id })); 
        mutate({ files: fileIdArr, folders: folderIdArr });
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <CustomButton type="button" variant="destructive" className="w-full cursor-default rounded-full">
                    <Trash2 />
                    Delete permanently
                </CustomButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="capitalize">Delete</DialogTitle>
                    <DialogDescription>
                        Once you delete, it will be permanently removed from the system and cannot be restored under any circumstances. 
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
