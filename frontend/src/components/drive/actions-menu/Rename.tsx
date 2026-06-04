import { rename } from "@/api/api";
import { CustomButton, InputField } from "@/components/global/FormElements";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

export default function Rename({ id, parent, type, isRenameDialogOpen, setRenameDialogOpen }: { id: string; parent: string; type: string, isRenameDialogOpen: boolean; setRenameDialogOpen: React.Dispatch<React.SetStateAction<boolean>>; }) {
    // toast
    const showToast = useCustomToast();

    // ref
    const cancelBtnRef = useRef<null | HTMLButtonElement>(null);

    // query
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: (data: { id: string, parent: string; name: string, type: string }) => rename(data),
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

    // handle rename 
    const handleRename = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries()) as { name: string };
        mutate({ id, parent, name: data.name, type })
    };

    return (
        <Dialog open={isRenameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleRename}>
                    <DialogHeader>
                        <DialogTitle className="capitalize">Rename {type}</DialogTitle>
                        <DialogDescription>
                            <InputField
                                className="mt-2 mb-4"
                                placeholder={`Enter ${type} name`}
                                id="name"
                                name="name"
                            />
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-start gap-2">
                        <CustomButton
                            loading={isPending}
                        >
                            Rename
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
                </form>
            </DialogContent>
        </Dialog>
    );
}
