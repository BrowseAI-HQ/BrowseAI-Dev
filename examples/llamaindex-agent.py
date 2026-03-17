"""
LlamaIndex Research Agent — BrowseAI Dev Example

A ReAct agent using LlamaIndex + BrowseAI Dev for evidence-backed research.

Usage:
    pip install llamaindex-browseaidev llama-index-llms-openai llama-index-core
    python llamaindex-agent.py
"""

from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI
from llamaindex_browseaidev import (
    BrowseAIDevSearchTool,
    BrowseAIDevAnswerTool,
    BrowseAIDevExtractTool,
    BrowseAIDevCompareTool,
)

# BrowseAI Dev tools — agent gets evidence-backed research
tools = [
    BrowseAIDevSearchTool(api_key="bai_xxx"),      # Web search
    BrowseAIDevAnswerTool(api_key="bai_xxx"),       # Full research pipeline (verified)
    BrowseAIDevExtractTool(api_key="bai_xxx"),      # Page extraction
    BrowseAIDevCompareTool(api_key="bai_xxx"),      # Raw LLM vs verified comparison
]

# Standard LlamaIndex agent setup
llm = OpenAI(model="gpt-4o")
agent = ReActAgent.from_tools(tools, llm=llm, verbose=True)

# Run
response = agent.chat(
    "What are the top 3 AI agent frameworks in 2025 and how do they compare?"
)

print("\n--- Result ---")
print(response)
