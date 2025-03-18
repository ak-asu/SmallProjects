# Mail Automate

A simple Python script to automatically respond to unread emails using AI-generated responses.

## Overview

Mail Automate connects to your Gmail account, reads unread emails, and automatically generates and sends personalized responses using the Perplexity AI API. This tool is perfect for:

- Handling routine emails during vacations or busy periods
- Creating quick, appropriate responses to common inquiries
- Testing AI-generated email responses for your workflow

## Features

- Reads unread emails from your Gmail inbox
- Generates context-aware responses using Perplexity AI
- Automatically sends replies with appropriate subject lines
- Simple configuration through environment variables

## Prerequisites

- Python 3.6 or higher
- A Gmail account
- Perplexity AI API key

## Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/mailautomate.git
cd mailautomate
```

2. Install the required packages:
```
pip install -r requirements.txt
```

3. Create a `.env` file based on the provided `.env.sample`:
```
cp .env.sample .env
```

4. Edit the `.env` file with your credentials:
```
GOOGLE_EMAIL=your.email@gmail.com
GOOGLE_PASSWORD=your-app-password
PPLX_KEY=your-perplexity-api-key
```

**Note:** For Gmail, you need to use an App Password, not your regular password. [Learn how to create an App Password](https://support.google.com/accounts/answer/185833).

## Usage

Simply run the script:

```
python gmail.py
```

The script will:
1. Connect to your Gmail account
2. Find unread emails
3. Generate responses using Perplexity AI
4. Send replies to each unread email

## License

This project is licensed under the MIT License.