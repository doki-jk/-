# FuelLog Privacy

FuelLog 0.3.0 is a local-first application.

## Data collected

FuelLog stores only the information the user enters, such as:

- food and meal records
- nutrition goals
- training/rest day status
- body measurements and notes
- profile values used for nutrition goal estimation
- favorites and food usage counts

## Storage locations

- The Windows desktop application stores data in a local SQLite database inside the current user's application data area.
- The web review stores data in the browser's local site storage.

FuelLog does not include an account system, analytics SDK, advertising SDK or cloud synchronization service. The current local food recognition feature does not send descriptions to an online AI service.

## Backups

The Data Management page can export a complete JSON backup and a meal CSV. These files may contain personal health-related information. The user is responsible for storing backup files securely.

Restoring a JSON backup replaces the current FuelLog data on that device after confirmation.

## Data deletion

- Individual meal and body records can be deleted in the application.
- Browser data can also be removed through browser site-data settings.
- Desktop data can be removed by deleting the application's local data directory after closing FuelLog.

## Nutrition disclaimer

Nutrition values, food portions and calorie goals are estimates. They are not medical diagnosis or treatment and may differ from product labels, laboratory measurements or professional advice.

## Future online features

Any future photo recognition, account, synchronization or hosted AI feature must be opt-in and must update this document before release to describe data transmission, retention and providers.
