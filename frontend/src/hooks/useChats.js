import { useQuery } from 'react-query';
import chatsService from '../services/chatsService';

export const useChats = (params) => {
    const { data, isLoading, error } = useQuery(['chats', params], () =>
        chatsService.getChats(params)
    );

    return {
        chats: data,
        isLoading,
        error,
    };
};
