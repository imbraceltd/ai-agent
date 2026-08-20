import { env } from '@/env';

interface AddNewPostAction {
    action: 'ADD_NEW';
    data:
        | {
              type: Exclude<API.ProductType, 'ai-assistant_management'>;
              credentialTotal: number;
          }
        | {
              type: 'ai-assistant_management';
              credentialType: 'line' | 'facebook' | 'instagram' | 'whatsapp' | 'web' | 'wechat' | 'openai';
              credentialTotal: number;
          };
}
interface SkipPostAction {
    action: 'SKIP';
    data: {
        type: API.ProductType;
        payload: API.BusinessContactCollectorPayload[];
        process_type: 'individual' | 'multiple';
        is_csv: boolean;
    };
}
interface CreateNewPostAction {
    action: 'CREATE_NEW';
    data: {
        type: API.ProductType;
        payload: API.BusinessContactCollectorPayload[];
        process_type: 'individual' | 'multiple';
        is_csv: boolean;
    };
}
interface AddNewAiAssistantReceiveAction {
    action: 'ADD_NEW_AI_ASSISTANT';
    data: {
        type: 'ai-assistant_management';
        apiKey: string;
        credential?: API.Credential;
    };
}
interface DuplicationFoundReceiveAction {
    action: 'DUPLICATION_FOUND';
    data: {
        contacts: API.MeilisearchItem[];
        type: API.ProductType;
        process_type: 'individual' | 'multiple';
        payload: API.BusinessContactCollectorPayload[];
        is_csv: boolean;
    };
}
interface AiAssistantMutationReceiveAction {
    action: 'UPDATE_AI_ASSISTANT' | 'REMOVE_AI_ASSISTANT';
    data: {
        type: 'ai-assistant_management';
        assistant: API.OpenAIAssistant;
        apiKey: string;
        credential?: API.Credential;
    };
}
interface CurrentDataPostAction {
    action: 'CURRENT_DATA';
}
interface CurrentDataReceiveAction {
    action: 'CURRENT_DATA';
    data: {
        type: API.ProductType;
        isDirty: boolean;
    } & Partial<API.Journey>;
}

interface RouteAction {
    action: 'ROUTE';
    data: {
        url: string;
        enabled?: boolean;
        state?: {
            orgApp?: API.Journey;
        };
    };
}
interface CredentialMutationPostAction {
    action: 'UPDATE_CREDENTIAL' | 'REMOVE_CREDENTIAL';
    data:
        | {
              type: Exclude<API.ProductType, 'email_campaign'>;
              credential: Record<string, unknown>;
              inUse?: string;
          }
        | {
              type: 'email_campaign';
              credential: API.EmailSender;
              inUse?: string;
          };
}

interface SaveAsNewTemplatePostAction {
    action: 'SAVE_AS_NEW_TEMPLATE';
    data: {
        subject: string;
        content: {
            content: string;
            files: { name: string; file_id: string; url: string; id: string }[];
        };
        board_id?: string;
    };
}
interface SaveAndExitPostAction {
    action: 'SAVE_AND_EXIT';
    data: {
        action: 'confirm' | 'cancel';
    };
}

interface NoteAbleToSavePostAction {
    action: 'NOT_ABLE_TO_SAVE';
    data: {
        action: 'confirm' | 'cancel';
    };
}
interface SimpleReceiveAction {
    action: 'SEND_ANOTHER_ONE' | 'SAVE_AND_EXIT' | 'NOT_ABLE_TO_SAVE' | 'NOT_ABLE_TO_SAVE_BEFORE_CLOSE';
    data?: {
        type: API.ProductType;
    };
}

interface SimplePostAction {
    action: 'REFRESH_AI_ASSISTANT' | 'SAVE_AND_EXIT_BEFORE_CLOSE';
}
interface UseTemplateReceiveAction {
    action: 'USE_TEMPLATE';
    data: {
        boardId: string;
    };
}
interface UseTemplatePostAction {
    action: 'USE_TEMPLATE';
    data: {
        subject: string;
        body: string;
        name: string;
        board_id?: string;
        attachments: { name: string; file_id: string; url: string }[];
    };
}
interface SaveAsNewTemplateReceiveAction {
    action: 'SAVE_AS_NEW_TEMPLATE';
    data: {
        subject: string;
        content: {
            content: string;
            files: { name: string; file_id: string; url: string; id: string }[];
        };
        board_id?: string;
    };
}
interface RefreshReceiveAction {
    action: 'REFRESH';
    data?: {
        // apply channel after refresh
        _id: string;
        name: string;
    };
}

interface CloseReceiveAction {
    action: 'CLOSE';
}

interface EditAppAction {
    action: 'EDIT_APP';
    data: {
        type: API.ProductType;
        appId: string;
    };
}
interface CredentialChangedAction {
    action: 'CREDENTIAL_CHANGED';
    data: {
        type: API.ProductType;
        id: string;
        name: string;
    };
}
interface InProgressReceiveAction {
    action: 'OPEN_IN_PROGRESS_MODAL';
    data: {
        type: API.ProductType;
        appId: string;
    };
}
interface InProgressPostAction {
    action: 'OPEN_IN_PROGRESS_MODAL';
    data: {
        type: API.ProductType;
        appData: API.Journey;
        action?: 'continue_setup' | 'start_fresh';
    };
}
interface EditFieldAction {
    action: 'EDIT_FIELD';
    data: {
        type: API.ProductType;
        board: API.Board;
        field: API.BoardField;
        name?: string;
    };
}
interface EditFormHeaderAction {
    action: 'EDIT_FORM_HEADER';
    data: {
        type: 'form_management';
        header?: string;
        banner_image?: string;
        sub_header?: string;
    };
}
interface AddFormFieldReceiveAction {
    action: 'ADD_FORM_FIELD';
    data: {
        type: 'form_management';
        existFields?: FormManagement.FormField[];
        index?: number;
    };
}
interface AddFormFieldPostAction {
    action: 'ADD_FORM_FIELD';
    data: {
        type: 'form_management';
        field: FormManagement.FormField;
        index?: number;
    };
}
interface EditFormFieldAction {
    action: 'EDIT_FORM_FIELD';
    data: {
        type: 'form_management';
        field: FormManagement.FormField;
        existFields?: FormManagement.FormField[];
        currentForm?: FormManagement.Form;
        index: number;
    };
}
interface EditFormFooterAction {
    action: 'EDIT_FORM_FOOTER';
    data: {
        type: 'form_management';
        submit_button_text?: string;
        footer?: string;
    };
}

interface RefetchSelectAction {
    action: 'REFETCH_SELECT';
    data: {
        type: API.ProductType;
        select: string;
    };
}

interface SelectTouchpointPostAction {
    action: 'SELECT_TOUCHPOINT';
    data: {
        type: API.ProductType;
        touchpoint: API.Touchpoint;
    };
}
interface OpenSelectTouchpointAction {
    action: 'OPEN_SELECT_TOUCHPOINT';
    data: {
        type: API.ProductType;
    };
}

interface OpenSupportCenterReceiveAction {
    action: 'OPEN_SUPPORT_CENTER';
    data: {
        prefilledMessage?: string;
    };
}

interface SetLanguagePostAction {
    action: 'SET_LANGUAGE';
    data: {
        language: string;
    };
}
interface OpenUnlockFeatureAction {
    action: 'OPEN_UNLOCK_FEATURE';
    data: {
        type: API.ProductType;
    };
}
interface OpenStarterReceiveAction {
    action: 'OPEN_STARTER';
    data: {
        type: API.ProductType;
    };
}
interface OpenShareReceiveAction {
    action: 'OPEN_SHARE';
    data: {
        type: 'form_management';
        form: FormManagement.Form;
    };
}

interface DeleteFormReceiveAction {
    action: 'DELETE_FORM';
    data: {
        type: 'form_management';
        id: string;
    };
}
interface SetBreadcrumbReceiveAction {
    action: 'SET_BREADCRUMB';
    data: {
        type: 'form_management';
        items?: {
            title: string;
            path: string;
            action?: {
                route?: boolean;
                step?: number;
            };
        }[];
        activePath?: string;
    };
}
interface StepControlPostAction {
    action: 'CHANGE_STEP';
    data: {
        type: API.ProductType;
        step: number;
    };
}
interface UpdateBoardAccessWarningReceiveAction {
    action: 'BOARD_ACCESS_WARNING';
    data: {
        type: 'form_management';
        forms: { _id: string; name: string }[];
    };
}
interface UpdateBoardAccessWarningPostAction {
    action: 'BOARD_ACCESS_WARNING';
    data: {
        type: 'form_management';
        confirm: boolean;
    };
}
interface SaveAndExitBeforeCloseReceiveAction {
    action: 'SAVE_AND_EXIT_BEFORE_CLOSE';
    data: {
        type: API.ProductType;
        done: boolean;
        name?: string;
        is_create?: boolean;
    };
}
interface DeleteAiAssistantReceiveAction {
    action: 'DELETE_AI_ASSISTANT';
    data: {
        type: 'ai-assistant_management';
        id: string;
        name: string;
    };
}
interface BackToMenuReceiveAction {
    action: 'BACK_TO_MENU';
    data: {
        type: API.ProductType;
    };
}
interface OpenKnowledgeHubReceiveAction {
    action: 'OPEN_KNOWLEDGE_HUB';
    data: {
        selected_board_id: string;
    };
}

interface OpenWorkflowFunctionsReceiveAction {
    action: 'OPEN_WORKFLOW_FUNCTIONS';
    data: {
        selected_workflow_functions: { id: string; name: string; description: string }[];
    };
}

interface SelectKnowledgeHubBoardPostAction {
    action: 'SELECT_KNOWLEDGE_HUB_BOARD';
    data: {
        board_id: string;
    };
}

interface SelectWorkflowFunctionsPostAction {
    action: 'SELECT_WORKFLOW_FUNCTIONS';
    data: {
        workflow_functions: { id: string; name: string; description: string }[];
    };
}

interface ShowCreateAiAssistantSuccessReceiveAction {
    action: 'SHOW_CREATE_AI_ASSISTANT_SUCCESS';
    data: {
        type: 'ai-assistant_management';
        data: API.OpenAIAssistant;
    };
}

interface ShowFinancialManagementFileErrorReceiveAction {
    action: 'SHOW_FINANCIAL_MANAGEMENT_FILE_ERROR';
    data: {
        id: string;
        fileName: string;
    };
}
interface FixedFinancialManagementFileErrorReceiveAction {
    action: 'FIXED_FINANCIAL_MANAGEMENT_FILE_ERROR';
    data: {
        fixedFileId: string
    };
}

interface ShowFinancialManagementFileContentReceiveAction {
    action: 'SHOW_FINANCIAL_MANAGEMENT_FILE_CONTENT';
    data: {
        id: string;
        fileName: string;
        type: 'file' | 'report';
    };
}

interface AddNewColumnToFinancialFileReceiveAction {
    action: 'ADD_NEW_COLUMN_TO_FINANCIAL_FILE';
    data: null;
}

interface AddedNewColumnToFinancialFilePostAction {
    action: 'ADDED_NEW_COLUMN_TO_FINANCIAL_FILE';
    data: {
        columnName: string;
        columnType: string;
    };
}

interface EditFinancialManagementFileReceiveAction {
    action: 'EDIT_FINANCIAL_MANAGEMENT_FILE';
    data: {
        id: string;
        fileName: string;
        fileDescription: string;
        type: 'file' | 'report';
    };
}

interface DeleteFinancialManagementFileReceiveAction {
    action: 'DELETE_FINANCIAL_MANAGEMENT_FILE';
    data: {
        id: string;
        type: 'file' | 'report';
    };
}

interface ResetFinancialFileReceiveAction {
    action: 'RESET_FINANCIAL_FILE';
    data: {
        fileId: string;
    };
}

export type MarketPlaceMessageEvent = MessageEvent<
    | SimpleReceiveAction
    | RefreshReceiveAction
    | UseTemplateReceiveAction
    | SaveAsNewTemplateReceiveAction
    | RouteAction
    | CredentialMutationPostAction
    | AddNewPostAction
    | CloseReceiveAction
    | EditAppAction
    | CredentialChangedAction
    | InProgressReceiveAction
    | CurrentDataReceiveAction
    | EditFieldAction
    | AddNewAiAssistantReceiveAction
    | AiAssistantMutationReceiveAction
    | OpenSelectTouchpointAction
    | OpenSupportCenterReceiveAction
    | OpenUnlockFeatureAction
    | DuplicationFoundReceiveAction
    | EditFormHeaderAction
    | AddFormFieldReceiveAction
    | EditFormFieldAction
    | EditFormFooterAction
    | OpenStarterReceiveAction
    | DeleteFormReceiveAction
    | SetBreadcrumbReceiveAction
    | OpenShareReceiveAction
    | UpdateBoardAccessWarningReceiveAction
    | SaveAndExitBeforeCloseReceiveAction
    | DeleteAiAssistantReceiveAction
    | BackToMenuReceiveAction
    | OpenKnowledgeHubReceiveAction
    | OpenWorkflowFunctionsReceiveAction
    | SelectKnowledgeHubBoardPostAction
    | SelectWorkflowFunctionsPostAction
    | ShowCreateAiAssistantSuccessReceiveAction
    | ShowFinancialManagementFileErrorReceiveAction
    | FixedFinancialManagementFileErrorReceiveAction
    | ShowFinancialManagementFileContentReceiveAction
    | AddNewColumnToFinancialFileReceiveAction
    | AddedNewColumnToFinancialFilePostAction
    | EditFinancialManagementFileReceiveAction
    | DeleteFinancialManagementFileReceiveAction
    | ResetFinancialFileReceiveAction
>;

interface BasedParams {
    event?: MarketPlaceMessageEvent;
    origin?: string;
    target?: Window | null;
}
type PostMessageParams = BasedParams &
    (
        | AddNewPostAction
        | CurrentDataPostAction
        | RouteAction
        | CredentialMutationPostAction
        | SimplePostAction
        | SaveAsNewTemplatePostAction
        | RefreshReceiveAction
        | InProgressPostAction
        | UseTemplatePostAction
        | RefetchSelectAction
        | SelectTouchpointPostAction
        | SetLanguagePostAction
        | SkipPostAction
        | CreateNewPostAction
        | EditFormHeaderAction
        | EditFormFooterAction
        | AddFormFieldPostAction
        | EditFormFieldAction
        | StepControlPostAction
        | UpdateBoardAccessWarningPostAction
        | SaveAndExitPostAction
        | NoteAbleToSavePostAction
        | DeleteAiAssistantReceiveAction
        | BackToMenuReceiveAction
        | OpenKnowledgeHubReceiveAction
        | SelectKnowledgeHubBoardPostAction
        | SelectWorkflowFunctionsPostAction
        | ShowCreateAiAssistantSuccessReceiveAction
        | ShowFinancialManagementFileErrorReceiveAction
        | FixedFinancialManagementFileErrorReceiveAction
        | ShowFinancialManagementFileContentReceiveAction
        | AddNewColumnToFinancialFileReceiveAction
        | AddedNewColumnToFinancialFilePostAction
        | EditFinancialManagementFileReceiveAction
        | DeleteFinancialManagementFileReceiveAction
        | ResetFinancialFileReceiveAction
    );

export const postMessage = (params: PostMessageParams) => {
    const { event, origin = '*', target, ...messageData } = params;
    if (env.VITE_APP_ENV === 'dev' || env.VITE_APP_ENV === 'local') {
        console.log('[Debug] postMessage params', params);
    }
    if (event) {
        event.source?.postMessage(messageData, { targetOrigin: origin });
    } else {
        target?.postMessage(messageData, origin);
    }
};
