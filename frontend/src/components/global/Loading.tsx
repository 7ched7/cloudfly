import { Skeleton } from "../ui/skeleton";

export function DrivePageLoading() {
    return (
        <>
            <Skeleton className="w-24 h-4 mb-2 mt-12 rounded-full" />
            <div className="h-20 lg:h-10 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8 gap-2 mt-4">
                <Skeleton className="w-full h-full rounded-full" />
                <Skeleton className="w-full h-full rounded-full" />
                <Skeleton className="w-full h-full rounded-full" />
                <Skeleton className="w-full h-full rounded-full" />
            </div>
            <Skeleton className="w-24 h-4 mb-2 mt-12 rounded-full" />
            <div className="h-80 lg:h-48 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8 gap-2 mt-4">
                <Skeleton className="w-full h-full rounded-md" />
                <Skeleton className="w-full h-full rounded-md" />
                <Skeleton className="w-full h-full rounded-md" />
                <Skeleton className="w-full h-full rounded-md" />
            </div>
        </>
    );
}

export function FileDownloadPageDetailsLoading() {
    return <>
            <div className='flex items-center gap-2 mb-4 p-2'>
                <Skeleton className='w-8 h-8' />
                <div>
                    <Skeleton className='w-32 h-2 mb-1' />
                    <Skeleton className='w-16 h-2' />
                </div>
            </div>
            <div className='p-2'>
                <Skeleton className='w-16 h-2' />
            </div>
            <Skeleton className='w-full h-20' />
            <Skeleton className='w-full h-10 mt-4' />
        </>
}