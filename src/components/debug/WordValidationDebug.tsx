import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { dictionaryManager, debugWordValidation } from '@/utils/dictionaryManager';

export function WordValidationDebug() {
  const [testWord, setTestWord] = useState('');
  const [validationResults, setValidationResults] = useState<any[]>([]);

  const testWordValidation = () => {
    if (!testWord.trim()) return;
    
    const result = dictionaryManager.validateWord(testWord);
    const status = dictionaryManager.getStatus();
    
    setValidationResults(prev => [
      {
        word: testWord,
        result,
        status,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev.slice(0, 9) // Keep last 10 results
    ]);

    // Debug to console as well
    debugWordValidation(testWord);
    setTestWord('');
  };

  const testCommonWords = () => {
    const commonWords = ['cat', 'dog', 'house', 'apple', 'water', 'quick', 'brown', 'fox'];
    commonWords.forEach(word => {
      const result = dictionaryManager.validateWord(word);
      setValidationResults(prev => [
        {
          word,
          result,
          status: dictionaryManager.getStatus(),
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    });
  };

  const clearResults = () => {
    setValidationResults([]);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Word Validation Debug</h3>
        <Button variant="outline" size="sm" onClick={clearResults}>
          Clear Results
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={testWord}
          onChange={(e) => setTestWord(e.target.value)}
          placeholder="Enter word to test..."
          onKeyDown={(e) => e.key === 'Enter' && testWordValidation()}
        />
        <Button onClick={testWordValidation} disabled={!testWord.trim()}>
          Test Word
        </Button>
        <Button variant="outline" onClick={testCommonWords}>
          Test Common Words
        </Button>
      </div>

      {validationResults.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {validationResults.map((item, index) => (
            <div key={index} className="p-2 border rounded text-sm">
              <div className="flex justify-between items-start">
                <div className="font-medium">
                  "{item.word.toUpperCase()}" - {item.timestamp}
                </div>
                <div className={`px-2 py-1 rounded text-xs ${
                  item.result.isValid 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {item.result.isValid ? 'VALID' : 'INVALID'}
                </div>
              </div>
              
              {!item.result.isValid && (
                <div className="mt-1 text-muted-foreground">
                  <div>Reason: {item.result.reason}</div>
                  {item.result.suggestions && (
                    <div>Suggestions: {item.result.suggestions.join(', ')}</div>
                  )}
                </div>
              )}
              
              <div className="mt-1 text-xs text-muted-foreground">
                Dictionary: {item.status.loaded ? `${item.status.wordCount.toLocaleString()} words` : 'Not loaded'}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}