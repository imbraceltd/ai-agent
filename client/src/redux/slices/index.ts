import messageReducer from './message';
import messageTemplatesReducer from './messageTemplates';
import organizationReducer from './organization';
import teamConversationReducer from './teamConversation';
import whatsAppMessageTemplatesReducer from './whatsAppTemplates';
import contactReducer from './contact';


const reducers = {
    WhatsAppMessageTemplates: whatsAppMessageTemplatesReducer,
    MessageTemplates: messageTemplatesReducer,
    TeamConversation: teamConversationReducer,
    Message: messageReducer,
    Organization: organizationReducer,
    Contact: contactReducer,
};

export default reducers;