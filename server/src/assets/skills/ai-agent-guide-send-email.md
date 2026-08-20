

Send Email
Send an email through a Gmail account.
Properties
FieldTypeRequiredDefaultDescription
Receiver
Email
(To)
ArrayYes—One or more
recipient email
addresses
Subject    TextYes—Email subject line
BodyTextYes—Email body content
Body
Type
DropdownYesplain text    plain textor
html
CC Email  Array    No—Carbon copy
recipients
BCC
Email
Array    No—Blind carbon copy
recipients
Reply-To
Email
Array    No—Address(es) for the
Reply-To header
Sender
Name
TextNo—Display name
shown as the
sender
Sender
Email
TextNo—Must be a verified
alias in your Gmail
settings
Attachments Array    No—Files to attach
(each item: File +
optional
Attachment Name)
In reply to  TextNo—Message-ID to
thread the reply
into an existing
conversation
Create
draft
CheckboxYesfalseSave as draft
instead of sending
Output
When sending (Create draft = false):
{
"id":"18c1a2b3d4e5f678",
"threadId":"18c1a2b3d4e5f678",
1

"labelIds":["SENT"]
}
When saving as draft (Create draft = true):
{
"id":"r1234567890abcdef",
"message":{
"id":"18c1a2b3d4e5f678",
"threadId":"18c1a2b3d4e5f678",
"labelIds":["DRAFT"]
}
}
Notes
•Sender Email— if omitted, the authenticated account’s primary email
is used automatically.
•In reply to— sets theIn-Reply-ToandReferencesheaders so the
email is grouped into an existing thread. Accepts a Gmail Message-ID
(e.g.<CABcd1234@mail.gmail.com>).
•Attachments— content type is auto-detected from the file extension.
Each attachment entry accepts an optional custom name to override the
original filename.
•Body Typehtml— pass a full HTML string in the Body field; it will
be sent as thetext/htmlMIME part.
•Subjectis encoded as UTF-8 Base64 internally to support non-ASCII
characters.
2