import ActivityFragment from "@/graphql/fragments/activity";
import gql from "graphql-tag";

const AddFavoriteActivity = gql`
  mutation AddFavoriteActivity($activityId: ID!) {
    addFavoriteActivity(activityId: $activityId) {
      ...Activity
    }
  }
  ${ActivityFragment}
`;

export default AddFavoriteActivity;
