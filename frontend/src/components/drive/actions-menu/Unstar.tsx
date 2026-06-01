import { FilesAndFoldersReqBody, unstar } from '@/api/api';
import { CustomButton } from '@/components/global/FormElements'
import useCustomToast from '@/hooks/useCustomToast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StarOff } from 'lucide-react'

export default function Unstar({ id, type }: { id: string, type: string }) {
    // toast
    const showToast = useCustomToast();

    // query
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: (data: FilesAndFoldersReqBody) => unstar(data),
        onSuccess: (data) => {
            showToast(data.message);
            queryClient.invalidateQueries({ queryKey: ['drive']});
            queryClient.invalidateQueries({ queryKey: ['quick-access']});
            queryClient.invalidateQueries({ queryKey: ['starred']});
        },
        onError: (data: any) => {
            showToast(data.response.data.error, false);
        }
    });

    // handle unstar
    const handleUnstar = () => {
        const param = type === "file" ? {files: [{ id }], folders: null} : {files: null, folders: [{ id }]}
        mutate(param);
    }

    return (
        <CustomButton onClick={handleUnstar} variant="secondary" effect={false} className="w-full justify-start bg-transparent cursor-default">
            <StarOff className="mr-1"/>
            Remove from Starred
        </CustomButton>
    )
}
