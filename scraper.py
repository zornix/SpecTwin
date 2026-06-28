import json
import os
from openai import OpenAI  # Or your preferred LLM provider orchestration
from youdotcom import You
from youdotcom.models import ContentsFormats
from pydantic import BaseModel
from spec import ProductSpecifications

# Initialize clients (Ensure YOU_API_KEY and OPENAI_API_KEY are set in your env)
you_client = You(api_key=os.getenv("YOU_API_KEY"))
openai_client = OpenAI()

def extract_specs_from_url(url: str) -> dict:
    print(f"Scraping content from: {url}...")
    
    try:
        response = you_client.contents.extract(url=url)
        page_markdown = response.content
        
        if not page_markdown:
            print(f"Failed to extract content for {url}")
            return {"url": url, "error": "No content retrieved"}
            
        print(f"Parsing specifications via LLM structured extraction...")
        completion = openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",  
            messages=[
                {"role": "system", "content": "You are a precise data extraction agent. Extract the required product specifications from the provided web page markdown. If a spec is not found, leave it as null."},
                {"role": "user", "content": f"URL Context: {url}\n\nWeb Page Content:\n{page_markdown}"}
            ],
            response_format=ProductSpecifications,
        )

        structured_data = completion.choices[0].message.parsed
        return {"url": url, "specs": structured_data.model_dump(), "status": "success"}

    except Exception as e:
        print(f"Error processing {url}: {str(e)}")
        return {"url": url, "error": str(e), "status": "failed"}

def main():
    # Load your target URLs
    with open("urls.json", "r") as f:
        config = json.load(f)
    
    results = []
    
    # Process each URL
    for url in config.get("urls", []):
        data = extract_specs_from_url(url)
        results.append(data)
        
    # Save the strictly formatted scraped data back to a file
    with open("scraped_products.json", "w") as f:
        json.dump(results, f, indent=4)
    
    print("\nScraping workflow complete! Results saved to scraped_products.json")

if __name__ == "__main__":
    main()