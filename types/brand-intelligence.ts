/**
 * Canonical input to the brand guide generator.
 * Used across all input modes (URL scan, Battle mode, Survey).
 * All fields are optional to support partial data from any mode.
 */
export interface BrandIntelligence {
  business_name?: string;
  logo_url?: string;
  origin_story?: string;
  business_goals?: string | string[];
  slogan_or_tagline?: string;
  unique_differentiators?: string | string[];
  primary_customer_result?: string;
  ideal_customer_review_example?: string;
  accreditations_and_awards?: string | string[];
  core_values?: string | string[];
  desired_emotional_response?: string;
  brand_voice_description?: string;
  brand_tone?: string;
  brand_should_not_sound_like?: string;
  desired_brand_perception?: string;
  buyer_persona?: string;
  local_area_name?: string;
  five_step_process?: string | string[];
  weather_events_causing_service_needs?: string | string[];
  handles_insurance_claims?: boolean;
  offers_drone_inspections?: boolean;
  year_founded?: number | string;
  preferred_call_to_action?: string;
  offers_financing?: boolean;
  financing_callouts?: string | string[];
  financing_disclaimers?: string | string[];
  reference_example_content?: string;
}
