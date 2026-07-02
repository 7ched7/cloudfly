import DownloadFile from './DownloadFile';
import { FileDownloadPageDetailsLoading } from '@/components/global/Loading';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DetailsProps {
    owner: {
        firstName: string;
        lastName: string;
        profileImage: string;
    };
    originalName: string;
    size: string;
    type: string;
}

export default function Details({ data, isLoading, error, keyProp }: { data: DetailsProps, isLoading: boolean, error: string, keyProp: string }) {
    return isLoading ?
                <FileDownloadPageDetailsLoading />
                :
                !error ? 
                <>
                    <div className="flex items-center gap-2 mb-4 p-2 border rounded-md">

                        <Avatar className="rounded-md w-8 h-8 select-none">
                            <AvatarImage
                                src={data.owner.profileImage}
                                alt={data.owner.firstName}
                            />
                            <AvatarFallback className="rounded-md">
                                {`${data.owner.firstName}`.slice(0, 1)}
                            </AvatarFallback>
                        </Avatar>

                        <div className="text-start">
                            <p className="font-semibold text-sm">
                                {data.owner.firstName} {data.owner.lastName}
                            </p>
                            <p className="text-zinc-500 text-xs">
                                Owner
                            </p>
                        </div>
                    </div>
                    <p className="font-bold text-xs text-muted-foreground p-2">
                        Details
                    </p>
                    <ul className="flex flex-col items-start space-y-2 text-muted-foreground text-sm bg-zinc-200 dark:bg-zinc-800 rounded-md p-2">
                        <li>
                            <p>
                                File name: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data.originalName}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Size: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{data.size}</span>
                            </p>
                        </li>
                        <li>
                            <p>
                                Type: <span className="text-zinc-800 dark:text-zinc-200 font-semibold uppercase">{data.type}</span>
                            </p>
                        </li>
                    </ul>
                   <DownloadFile originalName={data.originalName} keyProp={keyProp} />
                </>
                :
                <div className='w-full h-full flex items-center justify-center text-xs text-zinc-500 select-none'>
                    <p>{error}</p>
                </div>
}
