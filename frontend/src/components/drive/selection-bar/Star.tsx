import { FilesAndFoldersReqBody, star } from '@/api/api';
import { CustomButton } from '@/components/global/FormElements'
import useCustomToast from '@/hooks/useCustomToast';
import { SelectedItemsProps } from '@/pages/Drive';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderHeart } from 'lucide-react';

export default function Star({ items }: { items: SelectedItemsProps }) {
    // toast
    const showToast = useCustomToast();

    // query
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: (data: FilesAndFoldersReqBody) => star(data),
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

    // handle star
    const handleStar = () => {
        const fileIdArr = items.files.map((item) => ({ id: item.id })); 
        const folderIdArr = items.folders.map((item) => ({ id: item.id })); 
        mutate({ files: fileIdArr, folders: folderIdArr });
    }

    return (
        <CustomButton onClick={handleStar} type="button" variant="secondary" className="w-full cursor-default rounded-full">
            <FolderHeart />
            Add to Starred
        </CustomButton>
    )
}
