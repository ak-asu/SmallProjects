python
CopyEdit
import streamlit as st
from vertexai.language_models import TextGenerationModel
import vertexai
from google.oauth2 import service_account

creds = service_account.Credentials.from_service_account_file("service_account.json")
vertexai.init(project="campusgpt-workshop", location="us-central1", credentials=creds)
model = TextGenerationModel.from_pretrained("text-bison")

st.set_page_config(page_title="CampusGPT", page_icon="🎓")
st.title("CampusGPT: Ask ASU AI Agent")

with open("faqs.txt", "r") as f:
    faq_context = f.read()

user_question = st.text_input("Ask me anything about ASU:")

if st.button("Ask") and user_question:
    prompt = f"""
You are an AI assistant trained on the following ASU FAQs:

{faq_context}

User question: {user_question}
Answer:
"""
    response = model.predict(prompt=prompt, temperature=0.3, max_output_tokens=256)
    st.success(response.text.strip())

