"""CrewAI integration for BrowseAI Dev — verified web search with citations and confidence scores."""

from .tools import (
    BrowseAIDevAnswerTool,
    BrowseAIDevCompareTool,
    BrowseAIDevExtractTool,
    BrowseAIDevSearchTool,
)

__all__ = [
    "BrowseAIDevSearchTool",
    "BrowseAIDevAnswerTool",
    "BrowseAIDevExtractTool",
    "BrowseAIDevCompareTool",
]

__version__ = "0.1.0"
