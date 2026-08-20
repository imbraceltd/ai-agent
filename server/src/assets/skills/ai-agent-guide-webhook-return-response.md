

AI Agent Guide: Webhook Return Response
Piece:@activepieces/piece-webhook|Action:return_response|Ver-
sion:~0.1.24
This action sends an HTTP response back to the webhook caller. It MUST be
thelast stepin every webhook-triggered flow. No connection required.
1. Input Settings
PropertyTypeRequiredDefaultOptions
responseTypeSTATIC_DROPDOWNNo"json""json",
"raw",
"redirect"
fieldsDYNAMIC
(depends on
response-
Type)
Yes—See section 2
respondSTATIC_DROPDOWNNo"stop""stop"(end
flow),
"respond"
(continue
flow)
2.fieldssub-properties by responseType
responseType = “json” (most common)
Sub-fieldTypeRequiredDefaultDescription
statusNUMBER    No200HTTP status
code
headersOBJECTNo{}Custom
response
headers
bodyJSONYes—JSON
response
body. Use
{{step_N['...']}}
to reference
upstream
data.
1

responseType = “raw”
Sub-field  TypeRequired  Default
statusNUMBER  No200
headersOBJECT  No{}
bodyTEXTYes—
responseType = “redirect”
Sub-field  Type   Required
urlTEXTYes
3. Full Example — ADD then UPDATE
Step 1: ADD_ACTION
Update_flow(
flow_id = "<flow_id>",
operation = "ADD_ACTION",
operation_body = {
"parentStep": "step_3",
"stepLocationRelativeToParent": "AFTER",
"action": {
"name": "step_4",
"displayName": "Return Response",
"type": "PIECE",
"valid": false,
"settings": {
"pieceName": "@activepieces/piece-webhook",
"actionName": "return_response",
"pieceVersion": "~0.1.24",
"input": {},
"propertySettings": {},
"errorHandlingOptions": {}
}
}
}
)
Step 2: UPDATE_ACTION
Update_flow(
2

flow_id = "<flow_id>",
operation = "UPDATE_ACTION",
operation_body = {
"name": "step_4",
"displayName": "Return Response",
"type": "PIECE",
"valid": true,
"skip": false,
"settings": {
"pieceName": "@activepieces/piece-webhook",
"actionName": "return_response",
"pieceVersion": "~0.1.24",
"input": {
"responseType": "json",
"fields": {
"status": 200,
"headers": {},
"body": {
"success": true,
"full_name": "{{step_1['success'][0]['data']['properties']['full_name']}}",
"company": "{{step_1['success'][0]['data']['properties']['company']}}",
"record_id": "{{step_2['success']['recordId']}}"
}
},
"respond": "stop"
},
"propertySettings": {
"responseType": { "type": "MANUAL" },
"fields": {
"type": "MANUAL",
"schema": {
"status": { "displayName": "Status", "required": false, "defaultValue": 200, "type": "NUMBER" },
"headers": { "displayName": "Headers", "required": false, "type": "OBJECT" },
"body": { "displayName": "JSON Body", "required": true, "type": "JSON" }
}
},
"respond": { "type": "MANUAL" }
},
"errorHandlingOptions": {
"continueOnFailure": { "value": false },
"retryOnFailure": { "value": false }
}
}
}
)
3

4. verify_flow checklist
•responseType
set (usually
"json"
)
•fieldsmatches chosen responseType (see section 2)
•respondset ("stop"for last step)
•propertySettingshasschemaforfields(DYNAMIC property)
•errorHandlingOptionspresent with{ "value": false }entries
•valid=true
4