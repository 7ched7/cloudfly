import { FilesAndFoldersReqBody, moveToTrash } from "@/api/api";
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
import { SelectedItemsProps } from "@/pages/Drive";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRef } from "react";

export default function MovetoTrash({ items }: { items: SelectedItemsProps }) {
    // toast
    const showToast = useCustomToast();

    // ref
    const cancelBtnRef = useRef<null | HTMLButtonElement>(null);

    // query
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: (data: FilesAndFoldersReqBody) => moveToTrash(data),
        onSuccess: (data) => {
            showToast(data.message);
            queryClient.invalidateQueries({ queryKey: ['drive']});
            queryClient.invalidateQueries({ queryKey: ['quick-access']});
            queryClient.invalidateQueries({ queryKey: ['starred']});
            queryClient.invalidateQueries({ queryKey: ['trash']});
            cancelBtnRef.current?.click();
        },
        onError: (data: any) => {
            showToast(data.response.data.error, false);
        }
    });

    // handle move to trash
    const handleTrash = () => {
        const fileIdArr = items.files.map((item) => ({ id: item.id })); 
        const folderIdArr = items.folders.map((item) => ({ id: item.id })); 
        mutate({ files: fileIdArr, folders: folderIdArr });
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <CustomButton type="button" variant="destructive" className="w-full cursor-default rounded-full">
                    <Trash2 />
                    Move to Trash
                </CustomButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Move to Trash</DialogTitle>
                    <DialogDescription>
                        Once moved to trash, it will be automatically and permanently deleted after 1 month
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-start gap-2">
                    <CustomButton
                        onClick={handleTrash}
                        type="button"
                        loading={isPending}
                    >
                        Move to Trash
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
