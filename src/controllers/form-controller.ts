import { Request, Response } from 'express';
import { FormConfig } from '../types/form-types';
import { centralConfigService } from '../config/central-config';
import { updateSession } from '../services/session-service';
import { callMockService } from '../utils/mock-service';
import ejs from 'ejs';
import { v4 as uuidv4 } from 'uuid';

export const getForm = async (req: Request, res: Response) => {
  const { domain, formUrl } = req.params;
  const { session_id,flow_id,transaction_id } = req.query;

  // Determine the actual form URL to look up
  const actualFormUrl = domain ? `${domain}/${formUrl}` : formUrl;

  const formConfig = await centralConfigService.getFormConfig(actualFormUrl);

  if (!formConfig) {
    return res.status(404).json({ error: 'Form not found' });
  }

  // Get form service configuration for auto-injection
  const formServiceConfig = centralConfigService.getFormServiceConfig();
  const submitUrl = `${formServiceConfig.baseUrl}/forms/${actualFormUrl}/submit`;

  // Always load the form HTML from the config-specified path
  const htmlContent = formConfig.content;
  // Only pass actionUrl for EJS rendering, session data will be handled by JavaScript
  const newContent = ejs.render(htmlContent, { actionUrl: submitUrl });
  if(formConfig.type == "dynamic"){
    return res.set('Content-Type', 'application/html').send(newContent);
  }else{
    return res.type('html').send(newContent);
      }
};

export const submitForm = async (req: Request, res: Response) => {
  const { domain, formUrl } = req.params;
  const formData = {...req.body};
  
  // Parse submissionData - it might already be parsed (JSON request) or a string (form request)
  let submissionData;
  if (typeof req.body.submissionData === 'string') {
    submissionData = JSON.parse(req.body.submissionData);
  } else if (typeof req.body.submissionData === 'object') {
    submissionData = req.body.submissionData;
  } else {
    // If no submissionData, try to extract from query params for backward compatibility
    submissionData = {
      session_id: req.query.session_id,
      transaction_id: req.query.transaction_id,
      flow_id: req.query.flow_id
    };
  }
  
  delete formData.submissionData;

  // Determine the actual form URL to look up
  const actualFormUrl = domain ? `${domain}/${formUrl}` : formUrl;

  const formConfig = await centralConfigService.getFormConfig(actualFormUrl);

  if (!formConfig) {
    return res.status(404).json({ error: 'Form not found' });
  }

  try {
    // Update session with form data using the custom function
    await updateSession(formConfig.url, formData,submissionData.transaction_id);
    // await callMockService(domain,submissionData)

    res.json({ success: true, submission_id : uuidv4() });
  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ error: 'Failed to process form submission' });
  }
};
