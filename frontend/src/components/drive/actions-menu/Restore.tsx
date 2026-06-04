import { FilesAndFoldersReqBody, restore } from "@/api/api";
import { CustomButton } from "@/components/global/FormElements";
import useCustomToast from "@/hooks/useCustomToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";

export default function Restore({ id, type }: { id: string, type: string }) {
    // toast
    const showToast = useCustomToast();

    // query
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: (data: FilesAndFoldersReqBody) => restore(data),
        onSuccess: (data) => {
            showToast(data.message);
            queryClient.invalidateQueries({ queryKey: ['drive']});
            queryClient.invalidateQueries({ queryKey: ['quick-access']});
            queryClient.invalidateQueries({ queryKey: ['starred']});
            queryClient.invalidateQueries({ queryKey: ['trash']});
        },
        onError: (data: any) => {
            showToast(data.response.data.error, false);
        }
    });

    // handle restore
    const handleRestore = () => {
        const param = type === "file" ? {files: [{ id }], folders: null} : {files: null, folders: [{ id }]}
        mutate(param);
    }

    return (
        <CustomButton onClick={handleRestore} type="button" variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
            <RotateCcw className="mr-1"/>
            Restore
        </CustomButton>
    )
}
