import { FilesAndFoldersReqBody, unstar } from '@/api/api';
import { CustomButton } from '@/components/global/FormElements'
import useCustomToast from '@/hooks/useCustomToast';
import { SelectedItemsProps } from '@/pages/Drive';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StarOff } from 'lucide-react'

export default function Unstar({ items }: { items: SelectedItemsProps }) {
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
        const fileIdArr = items.files.map((item) => ({ id: item.id })); 
        const folderIdArr = items.folders.map((item) => ({ id: item.id })); 
        mutate({ files: fileIdArr, folders: folderIdArr });
    }

    return (
        <CustomButton onClick={handleUnstar} type="button" variant="secondary" className="w-full cursor-default rounded-full">
            <StarOff />
            Remove from Starred
        </CustomButton>
    )
}
