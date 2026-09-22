import ActivityFragment from "@/graphql/fragments/activity";
import gql from "graphql-tag";

const CreateActivity = gql`
  mutation CreateActivity($createActivityInput: CreateActivityInput!) {
    createActivity(createActivityInput: $createActivityInput) {
      ...Activity
    }
  }
  ${ActivityFragment}
`;

export default CreateActivity;
