import imaplib
import email
from openai import OpenAI
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import parseaddr
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("PPLX_KEY"), base_url="https://api.perplexity.ai")
sender_email = os.getenv("GOOGLE_EMAIL")
sender_password = os.getenv("GOOGLE_PASSWORD")

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(sender_email, sender_password)
mail.select("inbox")

status, messages = mail.search(None, "UNSEEN")
email_ids = messages[0].split()
email_from = ''
email_subject = ''
email_body = ''
email_name = ''
for email_id in email_ids:
    status, msg_data = mail.fetch(email_id, "(RFC822)")
    for response_part in msg_data:
        if isinstance(response_part, tuple):
            msg = email.message_from_bytes(response_part[1])
            email_name, email_from = parseaddr(msg["from"])
            email_subject = msg["subject"]
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition"))
                    if 'attachment' not in content_disposition and content_type == "text/plain":
                        email_body = part.get_payload(decode=True).decode()
                    else:
                        if content_type == "text/plain":
                            email_body = part.get_payload(decode=True).decode()
msgs = [
    {
        "role": "system",
        "content": "You help answering emails by providing the best response to the email"
    },
    {
        "role": "user",
        "content": email_body
    }
]

response = client.chat.completions.create(model="sonar-pro", messages=msgs)

msg = MIMEMultipart()
msg["From"] = sender_email
msg["To"] = email_from
msg["Subject"] = f"Re: {email_subject}"
msg.attach(MIMEText(response['choices'][0]['message']['content'], "plain"))

with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
    server.login(sender_email, sender_password)
    server.sendemail(sender_email, email_from, msg.as_string())

mail.logout()